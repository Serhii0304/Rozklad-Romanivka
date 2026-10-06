#!/usr/bin/env python3
"""Render the validated print PDFs as complete A4 PNGs and WebP previews.

Requires Poppler pdftoppm and Pillow with WebP support. Original timetable PNGs
and PDFs are read only. PNGs preserve the complete PDF page at 300 dpi, including
its white safety margins. Previews are 1400 pixels wide. Use --check to validate
published files, page dimensions, white margins and all input/output checksums.
Set PDFTOPPM or pass --poppler when pdftoppm is not on PATH or in the Codex runtime.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parent.parent
PDF_MANIFEST = ROOT / "assets/print-pdfs.json"
MANIFEST = ROOT / "assets/print-ready/manifest.json"
DPI = 300
PREVIEW_WIDTH = 1400
SAFETY_MARGIN_MM = 5
PAGE_SIZE_MM = (297, 210)
PAGE_SIZE_PX = tuple(math.ceil(length * DPI / 25.4) for length in PAGE_SIZE_MM)
DAYS = ("monday", "tuesday", "wednesday", "thursday", "friday")
EXPECTED_IDS = [f"class-{grade}-week" for grade in range(5, 12)] + list(DAYS)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def resolve_poppler(explicit: str | None) -> str:
    bundled = (Path.home() / ".cache/codex-runtimes/codex-primary-runtime/"
               "dependencies/native/poppler/Library/bin/pdftoppm.exe")
    candidates = (explicit, os.environ.get("PDFTOPPM"), shutil.which("pdftoppm"), bundled)
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(Path(candidate).resolve())
    raise FileNotFoundError("pdftoppm was not found; pass --poppler or set PDFTOPPM")


def definitions() -> list[dict]:
    manifest = json.loads(PDF_MANIFEST.read_text(encoding="utf-8"))
    assert manifest["schemaVersion"] == 2
    assert manifest["pageSizeMm"] == list(PAGE_SIZE_MM)
    assert manifest["safetyMarginMm"] == SAFETY_MARGIN_MM
    assert manifest["originalsUnmodified"] is True
    documents = {document["id"]: document for document in manifest["documents"]}
    specs = []
    for identifier in EXPECTED_IDS:
        document = documents[identifier]
        assert document["pageCount"] == len(document["sources"]) == 1
        assert all(document["validation"][flag] is True for flag in (
            "singleImagePerPage", "withinPrintableArea", "uncroppedImage",
            "noText", "noAnnotations"))
        source = document["sources"][0]
        assert sha256((ROOT / document["path"]).read_bytes()) == document["sha256"], \
            f"PDF checksum changed: {identifier}"
        assert sha256((ROOT / source["path"]).read_bytes()) == source["sha256"], \
            f"Original source checksum changed: {identifier}"
        specs.append({"id": identifier, "pdfPath": document["path"],
                      "pdfSha256": document["sha256"],
                      "imagePath": f"assets/print-ready/{identifier}.png",
                      "previewPath": f"assets/print-ready/{identifier}-preview.webp",
                      "sourcePath": source["path"], "sourceSha256": source["sha256"]})
    return specs


def validate_png(data: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(data)) as image:
        assert image.format == "PNG" and image.mode == "RGB", "Expected a rendered RGB PNG"
        assert image.size == PAGE_SIZE_PX, "Expected the complete A4 page at 300 dpi"
        assert all(abs(value - DPI) < 0.02 for value in image.info.get("dpi", (0, 0))), \
            "PNG print resolution must be 300 dpi"
        width, height = image.size
        # Permit one rasterization boundary pixel at the physical 5 mm limit.
        border = math.floor(SAFETY_MARGIN_MM * DPI / 25.4) - 1
        strips = ((0, 0, width, border), (0, height - border, width, height),
                  (0, 0, border, height), (width - border, 0, width, height))
        assert all(image.crop(box).getextrema() == ((255, 255),) * 3 for box in strips), \
            "The PNG must retain white safety margins on all four sides"
        assert ImageChops.difference(image, Image.new("RGB", image.size, "white")).getbbox(), \
            "The rendered page cannot be blank"
        return image.size


def validate_preview(data: bytes) -> None:
    with Image.open(io.BytesIO(data)) as preview:
        expected_height = round(PAGE_SIZE_PX[1] * PREVIEW_WIDTH / PAGE_SIZE_PX[0])
        assert preview.format == "WEBP" and preview.size == (PREVIEW_WIDTH, expected_height), \
            "Preview must show the complete A4 page at 1400 pixels wide"


def render(spec: dict, poppler: str) -> tuple[bytes, bytes]:
    with tempfile.TemporaryDirectory(prefix="romanivka-print-page-") as temporary:
        prefix = Path(temporary) / spec["id"]
        subprocess.run([poppler, "-f", "1", "-l", "1", "-singlefile",
                        "-r", str(DPI), "-png", str(ROOT / spec["pdfPath"]), str(prefix)],
                       check=True, capture_output=True)
        image_data = prefix.with_suffix(".png").read_bytes()
    validate_png(image_data)
    with Image.open(io.BytesIO(image_data)) as page:
        preview_size = (PREVIEW_WIDTH, round(page.height * PREVIEW_WIDTH / page.width))
        preview = page.resize(preview_size, Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        preview.save(buffer, format="WEBP", quality=90, method=6)
        preview_data = buffer.getvalue()
    validate_preview(preview_data)
    return image_data, preview_data


def build(check_only: bool, poppler_path: str | None) -> None:
    specs = definitions()
    if check_only:
        previous = json.loads(MANIFEST.read_text(encoding="utf-8"))
        outputs = [((ROOT / spec["imagePath"]).read_bytes(),
                    (ROOT / spec["previewPath"]).read_bytes()) for spec in specs]
    else:
        poppler = resolve_poppler(poppler_path)
        with ThreadPoolExecutor(max_workers=3) as pool:
            outputs = list(pool.map(lambda spec: render(spec, poppler), specs))
    records = []
    for spec, (image_data, preview_data) in zip(specs, outputs):
        width, height = validate_png(image_data)
        validate_preview(preview_data)
        records.append({**spec, "imageSha256": sha256(image_data),
                        "previewSha256": sha256(preview_data), "width": width, "height": height})
    manifest = {"schemaVersion": 1, "renderMethod": "poppler-pdf",
                "safetyMarginMm": SAFETY_MARGIN_MM, "dpi": DPI,
                "originalsUnmodified": True, "images": records}
    # Recheck every input before publishing to detect changes during rendering.
    assert definitions() == specs, "PDFs or original PNGs changed during rendering"
    if check_only:
        assert previous == manifest, "Print-ready images or manifest are stale; rebuild images"
    else:
        MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        for spec, (image_data, preview_data) in zip(specs, outputs):
            (ROOT / spec["imagePath"]).write_bytes(image_data)
            (ROOT / spec["previewPath"]).write_bytes(preview_data)
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{'Verified' if check_only else 'Rendered and verified'} {len(records)} complete "
          f"A4 PNGs at {DPI} dpi ({PAGE_SIZE_PX[0]} x {PAGE_SIZE_PX[1]} px), "
          f"plus {PREVIEW_WIDTH} px WebP previews; minimum 5 mm white margins retained.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify existing files without rendering")
    parser.add_argument("--poppler", help="Path to the pdftoppm executable")
    arguments = parser.parse_args()
    build(arguments.check, arguments.poppler)
