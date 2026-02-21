#!/usr/bin/env python3
import json
import hashlib
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def json_to_pretty_text(json_path: Path) -> str:
    obj = json.loads(json_path.read_text(encoding="utf-8"))
    return json.dumps(obj, indent=2, ensure_ascii=False)

def write_pdf(text: str, out_pdf: Path, title: str, footer: str):
    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(out_pdf), pagesize=letter)
    width, height = letter

    left = 36
    top = height - 36
    bottom = 36
    line_height = 10
    max_lines = int((top - bottom) / line_height) - 4

    def header():
        c.setFont("Courier", 10)
        c.drawString(left, top, title)
        c.setFont("Courier", 8)
        c.drawString(left, top - 12, footer)

    lines = text.splitlines()
    page = 1
    i = 0
    while i < len(lines):
        header()
        y = top - 30
        c.setFont("Courier", 8)

        for _ in range(max_lines):
            if i >= len(lines):
                break
            # hard-wrap safety so long lines don't blow out the margin
            c.drawString(left, y, lines[i][:220])
            y -= line_height
            i += 1

        c.setFont("Courier", 8)
        c.drawRightString(width - 36, bottom - 10, f"Page {page}")
        c.showPage()
        page += 1

    c.save()

def freeze(json_in: Path, pdf_out: Path, name_base: str, write_hash: bool = True):
    pretty = json_to_pretty_text(json_in)
    h = sha256_file(json_in)

    footer = f"Source: {json_in.as_posix()} | SHA-256: {h}"
    write_pdf(pretty, pdf_out, title=name_base, footer=footer)

    if write_hash:
        sha_path = pdf_out.with_suffix(".sha256")
        sha_path.write_text(f"{h}  {json_in.name}\n", encoding="utf-8")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 4:
        print("Usage: freeze_json_pdf.py <input.json> <output.pdf> <name_base>")
        raise SystemExit(2)

    freeze(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])