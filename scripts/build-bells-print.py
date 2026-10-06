#!/usr/bin/env python3
"""Publish the accepted bells artwork as one image-only A4 portrait print page.

The original PNG is read only. It is embedded losslessly, centered and fitted
proportionally, with at least 5 mm of white paper on every side. One extra raster
pixel of inset ensures even the complete 300 dpi PNG has 5 mm of wholly white
edge pixels. Poppler renders that PDF; the WebP previews the entire paper page.
Use --check to verify all published bytes, decoded PDF pixels, page geometry,
white print margins and manifest values without modifying any output.
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

from PIL import Image, ImageChops
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, NameObject
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent.parent
DIRECTORY = "assets/print-bells"
SOURCE_PATH = f"{DIRECTORY}/bells-original.png"
PDF_PATH = f"{DIRECTORY}/bells-a4.pdf"
IMAGE_PATH = f"{DIRECTORY}/bells-a4.png"
PREVIEW_PATH = f"{DIRECTORY}/bells-preview.webp"
MANIFEST = ROOT / DIRECTORY / "manifest.json"
PAGE_SIZE_MM = (210, 297)
PAGE_SIZE_PT = A4
SAFETY_MARGIN_MM = 5
DPI = 300
PREVIEW_WIDTH = 1400
PAGE_SIZE_PX = tuple(math.ceil(length * DPI / 25.4) for length in PAGE_SIZE_MM)
SAFETY_MARGIN_PT = SAFETY_MARGIN_MM * mm
PLACEMENT_MARGIN_PT = SAFETY_MARGIN_PT + 72 / DPI
GEOMETRY_TOLERANCE_PT = 0.0001
TEXT_OPERATORS = {b"BT", b"ET", b"Tf", b"TL", b"Tj", b"TJ", b"'", b'"'}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_source() -> dict:
    data = (ROOT / SOURCE_PATH).read_bytes()
    with Image.open(io.BytesIO(data)) as image:
        assert image.format == "PNG", "The accepted original must be a PNG"
        assert image.mode in {"RGB", "RGBA", "P", "L", "LA"}, \
            "The original must have losslessly representable 8-bit RGB pixel values"
        assert image.height > image.width, "The bells artwork must be portrait"
        assert getattr(image, "n_frames", 1) == 1, "The original must be one static image"
        # An opaque palette, grayscale or RGBA PNG can be represented as RGB
        # without changing displayed pixel values. Never silently discard alpha.
        rgba = image.convert("RGBA")
        assert rgba.getchannel("A").getextrema() == (255, 255), \
            "The original must be opaque; transparency cannot be discarded"
        rgb = image.convert("RGB")
        width, height = rgb.size
        pixels = rgb.tobytes()
    return {"path": SOURCE_PATH, "sha256": sha256(data), "width": width,
            "height": height, "pixels": pixels}


def placement(source: dict) -> dict:
    available_width = PAGE_SIZE_PT[0] - 2 * PLACEMENT_MARGIN_PT
    available_height = PAGE_SIZE_PT[1] - 2 * PLACEMENT_MARGIN_PT
    scale = min(available_width / source["width"],
                available_height / source["height"])
    width, height = source["width"] * scale, source["height"] * scale
    return {"x": (PAGE_SIZE_PT[0] - width) / 2,
            "y": (PAGE_SIZE_PT[1] - height) / 2,
            "width": width, "height": height}


def create_pdf(source: dict) -> bytes:
    buffer = io.BytesIO()
    document = canvas.Canvas(buffer, pagesize=PAGE_SIZE_PT, pageCompression=1,
                             invariant=1, bottomup=1)
    rgb = Image.frombytes("RGB", (source["width"], source["height"]), source["pixels"])
    document.drawImage(ImageReader(rgb), **placement(source), mask=None)
    document.showPage()
    document.save()

    # ReportLab initializes an unused font. Remove its empty text setup and
    # resource, leaving precisely one losslessly encoded image draw on the page.
    reader = PdfReader(io.BytesIO(buffer.getvalue()))
    page = reader.pages[0]
    content = ContentStream(page.get_contents(), reader)
    assert not any(operator in {b"Tj", b"TJ", b"'", b'"'}
                   for _, operator in content.operations)
    content.operations = [(operands, operator) for operands, operator in content.operations
                          if operator not in TEXT_OPERATORS]
    page[NameObject("/Contents")] = content
    page["/Resources"].pop("/Font", None)
    writer = PdfWriter()
    writer.add_page(page)
    result = io.BytesIO()
    writer.write(result)
    return result.getvalue()


def validate_pdf(data: bytes, source: dict) -> dict:
    reader = PdfReader(io.BytesIO(data), strict=True)
    assert not reader.is_encrypted, "The PDF must be printable without a password"
    assert len(reader.pages) == 1, "The bells PDF must contain exactly one page"
    assert not reader.trailer["/Root"].get("/AcroForm"), "Unexpected form"
    page = reader.pages[0]
    size = (float(page.mediabox.width), float(page.mediabox.height))
    assert all(abs(actual - expected) < GEOMETRY_TOLERANCE_PT
               for actual, expected in zip(size, PAGE_SIZE_PT)), "Expected A4 portrait"
    assert list(page.cropbox) == list(page.mediabox), "Unexpected crop"
    assert float(page.mediabox.left) == float(page.mediabox.bottom) == 0
    assert not page.get("/Annots"), "Unexpected annotation"
    assert not page.get("/Rotate"), "Unexpected page rotation"
    assert not page.extract_text().strip(), "Unexpected text layer"
    assert not page["/Resources"].get("/Font"), "Unexpected font resource"
    objects = page["/Resources"]["/XObject"]
    assert len(objects) == 1, "Expected exactly one image resource"
    name, reference = next(iter(objects.items()))
    image = reference.get_object()
    assert image["/Subtype"] == "/Image", "Unexpected non-image object"
    assert (image["/Width"], image["/Height"]) == (source["width"], source["height"])
    assert image["/ColorSpace"] == "/DeviceRGB" and image["/BitsPerComponent"] == 8
    assert not image.get("/SMask") and not image.get("/Mask"), "Unexpected image mask"
    assert not image.get("/Decode"), "Unexpected color remapping"
    assert image.get_data() == source["pixels"], "Embedded original pixels changed"
    operations = ContentStream(page.get_contents(), reader).operations
    assert [operator for _, operator in operations] == [b"cm", b"q", b"cm", b"Do", b"Q"], \
        "Expected one image draw and no clipping, text or decoration"
    assert [operands for operands, operator in operations if operator == b"Do"] == [[name]]
    matrices = [list(map(float, operands)) for operands, operator in operations
                if operator == b"cm"]
    assert matrices[0] == [1, 0, 0, 1, 0, 0]
    expected = placement(source)
    expected_matrix = [expected["width"], 0, 0, expected["height"], expected["x"], expected["y"]]
    assert all(abs(actual - expected_value) < GEOMETRY_TOLERANCE_PT
               for actual, expected_value in zip(matrices[1], expected_matrix)), \
        "Image must fit proportionally and be centered"
    width, _, _, height, x, y = matrices[1]
    margins = (x, y, size[0] - x - width, size[1] - y - height)
    assert min(margins) >= SAFETY_MARGIN_PT - GEOMETRY_TOLERANCE_PT, \
        "Image crosses a 5 mm safety margin"
    assert abs(width / source["width"] - height / source["height"]) < \
        GEOMETRY_TOLERANCE_PT / max(source["width"], source["height"]), \
        "Original aspect ratio changed"
    assert abs(x - margins[2]) < GEOMETRY_TOLERANCE_PT
    assert abs(y - margins[3]) < GEOMETRY_TOLERANCE_PT
    return {"singleImage": True, "pixelsUnchanged": True, "noText": True,
            "uncropped": True, "safeMargins": True}


def resolve_poppler(explicit: str | None) -> str:
    bundled = (Path.home() / ".cache/codex-runtimes/codex-primary-runtime/"
               "dependencies/native/poppler/Library/bin/pdftoppm.exe")
    for candidate in (explicit, os.environ.get("PDFTOPPM"), shutil.which("pdftoppm"), bundled):
        if candidate and Path(candidate).is_file():
            return str(Path(candidate).resolve())
    raise FileNotFoundError("pdftoppm was not found; pass --poppler or set PDFTOPPM")


def validate_png(data: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(data)) as image:
        assert image.format == "PNG" and image.mode == "RGB", "Expected a rendered RGB PNG"
        assert image.size == PAGE_SIZE_PX, "Expected the complete A4 portrait page at 300 dpi"
        assert all(abs(value - DPI) < 0.02 for value in image.info.get("dpi", (0, 0))), \
            "PNG print resolution must be 300 dpi"
        width, height = image.size
        border = math.ceil(SAFETY_MARGIN_MM * DPI / 25.4)
        strips = ((0, 0, width, border), (0, height - border, width, height),
                  (0, 0, border, height), (width - border, 0, width, height))
        assert all(image.crop(box).getextrema() == ((255, 255),) * 3 for box in strips), \
            "All four PNG edges must retain at least 5 mm of entirely white pixels"
        assert ImageChops.difference(image, Image.new("RGB", image.size, "white")).getbbox(), \
            "The rendered page cannot be blank"
        return image.size


def validate_preview(data: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(data)) as image:
        expected = (PREVIEW_WIDTH, round(PAGE_SIZE_PX[1] * PREVIEW_WIDTH / PAGE_SIZE_PX[0]))
        assert image.format == "WEBP" and image.size == expected, \
            "Preview must show the complete A4 page at 1400 pixels wide"
        return image.size


def render_pdf(data: bytes, poppler: str) -> tuple[bytes, bytes]:
    with tempfile.TemporaryDirectory(prefix="romanivka-bells-print-") as temporary:
        pdf_path = Path(temporary) / "bells-a4.pdf"
        prefix = Path(temporary) / "bells-a4"
        pdf_path.write_bytes(data)
        subprocess.run([poppler, "-f", "1", "-l", "1", "-singlefile", "-r", str(DPI),
                        "-png", str(pdf_path), str(prefix)], check=True, capture_output=True)
        image_data = prefix.with_suffix(".png").read_bytes()
    validate_png(image_data)
    with Image.open(io.BytesIO(image_data)) as image:
        size = (PREVIEW_WIDTH, round(image.height * PREVIEW_WIDTH / image.width))
        preview = image.resize(size, Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        preview.save(buffer, format="WEBP", quality=90, method=6)
        preview_data = buffer.getvalue()
    validate_preview(preview_data)
    return image_data, preview_data


def build(check_only: bool, poppler_path: str | None) -> None:
    source = read_source()
    if check_only:
        previous = json.loads(MANIFEST.read_text(encoding="utf-8"))
        pdf_data = (ROOT / PDF_PATH).read_bytes()
        image_data = (ROOT / IMAGE_PATH).read_bytes()
        preview_data = (ROOT / PREVIEW_PATH).read_bytes()
    else:
        poppler = resolve_poppler(poppler_path)
        pdf_data = create_pdf(source)
        validate_pdf(pdf_data, source)
        image_data, preview_data = render_pdf(pdf_data, poppler)
    validation = validate_pdf(pdf_data, source)
    image_width, image_height = validate_png(image_data)
    preview_width, preview_height = validate_preview(preview_data)
    manifest = {
        "schemaVersion": 1,
        "pageSizeMm": list(PAGE_SIZE_MM),
        "safetyMarginMm": SAFETY_MARGIN_MM,
        "originalUnmodified": True,
        "source": {key: source[key] for key in ("path", "sha256", "width", "height")},
        "pdf": {"path": PDF_PATH, "sha256": sha256(pdf_data), "pageCount": 1},
        "image": {"path": IMAGE_PATH, "sha256": sha256(image_data), "width": image_width,
                  "height": image_height, "dpi": DPI},
        "preview": {"path": PREVIEW_PATH, "sha256": sha256(preview_data),
                    "width": preview_width, "height": preview_height},
        "placementPt": placement(source),
        "validation": validation,
    }
    assert sha256((ROOT / SOURCE_PATH).read_bytes()) == source["sha256"], \
        "Original PNG changed during the operation"
    if check_only:
        assert previous == manifest, "Bells print manifest or published inputs are stale"
    else:
        MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        for relative, data in ((PDF_PATH, pdf_data), (IMAGE_PATH, image_data),
                               (PREVIEW_PATH, preview_data)):
            (ROOT / relative).write_bytes(data)
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")
    verb = "Verified" if check_only else "Created and verified"
    print(f"{verb} bells print: one image-only A4 portrait PDF; unchanged source pixels; "
          f"complete {image_width} x {image_height} PNG at {DPI} dpi; "
          f"{preview_width} x {preview_height} WebP; minimum 5 mm white margins.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify published files without writing")
    parser.add_argument("--poppler", help="Path to the pdftoppm executable")
    arguments = parser.parse_args()
    build(arguments.check, arguments.poppler)
