#!/usr/bin/env python3
"""Fit the accepted, unchanged timetable PNGs inside A4 landscape print margins.

Requires Pillow, reportlab and pypdf. Run from any working directory. No raster
edits, page decorations or captions are applied. Images are centered with at
least 5 mm of white paper on every side, without stretching or cropping. The --check
option verifies the published files and source checksums without writing files.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, NameObject
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "assets/print-pdfs.json"
PAGE_SIZE = landscape(A4)
SAFETY_MARGIN_MM = 5
SAFETY_MARGIN_PT = SAFETY_MARGIN_MM * mm
GEOMETRY_TOLERANCE_PT = 0.0001
DAYS = ("monday", "tuesday", "wednesday", "thursday", "friday")
TEXT_OPERATORS = {b"BT", b"ET", b"Tf", b"TL", b"Tj", b"TJ", b"'", b'"'}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def definitions() -> list[dict]:
    documents = [
        {"id": f"class-{grade}-week", "type": "class",
         "path": f"assets/print/class-{grade}-week.pdf",
         "sourcePaths": [f"assets/print/class-{grade}-week.png"]}
        for grade in range(5, 12)
    ]
    documents += [
        {"id": day, "type": "day", "path": f"assets/print-week/{day}.pdf",
         "sourcePaths": [f"assets/print-week/{day}.png"]}
        for day in DAYS
    ]
    documents.append({"id": "week-all-classes", "type": "week",
                      "path": "assets/print-week/week-all-classes.pdf",
                      "sourcePaths": [f"assets/print-week/{day}.png" for day in DAYS]})
    return documents


def read_source(relative: str) -> dict:
    data = (ROOT / relative).read_bytes()
    with Image.open(io.BytesIO(data)) as image:
        assert image.format == "PNG", f"Expected PNG: {relative}"
        assert image.mode == "RGB", f"Expected accepted RGB original: {relative}"
        width, height = image.size
        assert 1.35 < width / height < 1.5, f"Expected landscape image: {relative}"
        pixels = image.tobytes()
    return {"path": relative, "sha256": sha256(data), "width": width,
            "height": height, "data": data, "pixels": pixels}


def public_source(source: dict) -> dict:
    return {key: source[key] for key in ("path", "sha256", "width", "height")}


def placement(source: dict) -> dict:
    """Largest proportional image centered within the 287 x 200 mm area."""
    available_width = PAGE_SIZE[0] - 2 * SAFETY_MARGIN_PT
    available_height = PAGE_SIZE[1] - 2 * SAFETY_MARGIN_PT
    scale = min(available_width / source["width"],
                available_height / source["height"])
    width = source["width"] * scale
    height = source["height"] * scale
    return {"x": (PAGE_SIZE[0] - width) / 2,
            "y": (PAGE_SIZE[1] - height) / 2,
            "width": width, "height": height}


def create_pdf(sources: list[dict]) -> bytes:
    buffer = io.BytesIO()
    document = canvas.Canvas(buffer, pagesize=PAGE_SIZE, pageCompression=1,
                             invariant=1, bottomup=1)
    for source in sources:
        image_placement = placement(source)
        document.drawImage(ImageReader(io.BytesIO(source["data"])),
                           **image_placement, preserveAspectRatio=True, mask=None)
        document.showPage()
    document.save()

    # ReportLab initializes an unused font on every page. Remove that empty
    # text setup and its font resource so the delivered page is image-only,
    # including its PDF content stream. Image data is copied losslessly.
    reader = PdfReader(io.BytesIO(buffer.getvalue()))
    writer = PdfWriter()
    for page in reader.pages:
        content = ContentStream(page.get_contents(), reader)
        assert not any(operator in {b"Tj", b"TJ", b"'", b'"'}
                       for _, operator in content.operations)
        content.operations = [(operands, operator)
                              for operands, operator in content.operations
                              if operator not in TEXT_OPERATORS]
        page[NameObject("/Contents")] = content
        page["/Resources"].pop("/Font", None)
        writer.add_page(page)
    result = io.BytesIO()
    writer.write(result)
    return result.getvalue()


def validate_pdf(data: bytes, sources: list[dict]) -> dict:
    reader = PdfReader(io.BytesIO(data), strict=True)
    assert not reader.is_encrypted, "PDF must be printable without a password"
    assert len(reader.pages) == len(sources), "Wrong PDF page count"
    assert not reader.trailer["/Root"].get("/AcroForm"), "Unexpected form"
    for index, (page, source) in enumerate(zip(reader.pages, sources), start=1):
        size = [float(page.mediabox.width), float(page.mediabox.height)]
        assert all(abs(actual - expected) < GEOMETRY_TOLERANCE_PT
                   for actual, expected in zip(size, PAGE_SIZE)), (index, size)
        assert list(page.cropbox) == list(page.mediabox), "Unexpected crop"
        assert float(page.mediabox.left) == float(page.mediabox.bottom) == 0
        assert not page.get("/Annots"), "Unexpected annotation"
        assert not page.get("/Rotate"), "Unexpected page rotation"
        assert not page.extract_text().strip(), "Unexpected text layer"
        assert not page["/Resources"].get("/Font"), "Unexpected font resource"
        xobjects = page["/Resources"]["/XObject"]
        assert len(xobjects) == 1, "Expected one image resource per page"
        name, reference = next(iter(xobjects.items()))
        image = reference.get_object()
        assert image["/Subtype"] == "/Image", "Unexpected non-image object"
        assert image["/Width"] == source["width"]
        assert image["/Height"] == source["height"]
        assert image["/ColorSpace"] == "/DeviceRGB"
        assert image["/BitsPerComponent"] == 8
        assert not image.get("/SMask") and not image.get("/Mask")
        assert image.get_data() == source["pixels"], "Image pixels changed"
        operations = ContentStream(page.get_contents(), reader).operations
        assert [operator for _, operator in operations] == \
            [b"cm", b"q", b"cm", b"Do", b"Q"], \
            "Expected one image draw inside its placement transform, without clipping"
        draws = [operands for operands, operator in operations if operator == b"Do"]
        assert draws == [[name]], "Expected exactly one image draw per page"
        matrices = [list(map(float, operands)) for operands, operator in operations
                    if operator == b"cm"]
        assert len(matrices) == 2 and matrices[0] == [1, 0, 0, 1, 0, 0]
        expected = placement(source)
        expected_matrix = [expected["width"], 0, 0, expected["height"],
                           expected["x"], expected["y"]]
        assert all(abs(actual - expected) < GEOMETRY_TOLERANCE_PT
                   for actual, expected in zip(matrices[1], expected_matrix)), \
            "Image must fit proportionally and be centered in the printable area"
        width, _, _, height, x, y = matrices[1]
        margins = (x, y, size[0] - x - width, size[1] - y - height)
        assert min(margins) >= SAFETY_MARGIN_PT - GEOMETRY_TOLERANCE_PT, \
            "Image crosses the 5 mm safety margin"
        assert abs(width / source["width"] - height / source["height"]) < \
            GEOMETRY_TOLERANCE_PT / max(source["width"], source["height"]), \
            "Image must keep its original aspect ratio"
        assert abs(x - margins[2]) < GEOMETRY_TOLERANCE_PT
        assert abs(y - margins[3]) < GEOMETRY_TOLERANCE_PT
    return {"singleImagePerPage": True, "withinPrintableArea": True,
            "uncroppedImage": True,
            "noText": True, "noAnnotations": True}


def build(check_only: bool) -> None:
    specs = definitions()
    source_paths = dict.fromkeys(path for spec in specs for path in spec["sourcePaths"])
    sources = {path: read_source(path) for path in source_paths}
    outputs = []
    records = []
    previous = json.loads(MANIFEST.read_text(encoding="utf-8")) if check_only else None
    for spec in specs:
        page_sources = [sources[path] for path in spec["sourcePaths"]]
        data = (ROOT / spec["path"]).read_bytes() if check_only else create_pdf(page_sources)
        validation = validate_pdf(data, page_sources)
        records.append({"id": spec["id"], "type": spec["type"],
                        "path": spec["path"], "sha256": sha256(data),
                        "pageCount": len(page_sources), "pageSizePt": list(PAGE_SIZE),
                        "sources": [public_source(source) for source in page_sources],
                        "placementsPt": [placement(source) for source in page_sources],
                        "validation": validation})
        outputs.append((ROOT / spec["path"], data))
    manifest = {"schemaVersion": 2, "format": "A4 landscape",
                "pageSizeMm": [297, 210], "pageSizePt": list(PAGE_SIZE),
                "safetyMarginMm": SAFETY_MARGIN_MM,
                "generationMethod": "reportlab-image-only", "originalsUnmodified": True,
                "pdfCount": len(records),
                "imagePageCount": sum(record["pageCount"] for record in records),
                "documents": records}
    # All outputs are authored and structurally verified before publication.
    if check_only:
        assert previous == manifest, "PDF manifest or published inputs are stale; rebuild PDFs"
    else:
        for output, data in outputs:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(data)
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")
    for path, source in sources.items():
        assert sha256((ROOT / path).read_bytes()) == source["sha256"], "Original PNG changed"
    print(f"{'Verified' if check_only else 'Created and verified'} {len(records)} PDFs, "
          f"{manifest['imagePageCount']} image-only A4 landscape pages; "
          f"proportional centered fit, minimum {SAFETY_MARGIN_MM} mm margins, no cropping or text.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify existing PDFs and manifest")
    build(parser.parse_args().check)
