from __future__ import annotations

import argparse
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, StyleSheet1, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = ROOT / "school-mgmt" / "docs" / "operations" / "checklist-opening-center-detailed.md"
DEFAULT_OUTPUT = ROOT / "checklist.pdf"


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
    pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))


def build_styles() -> StyleSheet1:
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="TitleArial",
            parent=styles["Title"],
            fontName="Arial-Bold",
            fontSize=21,
            leading=27,
            textColor=colors.HexColor("#0F172A"),
            alignment=TA_CENTER,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="MetaArial",
            parent=styles["Normal"],
            fontName="Arial",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#475569"),
            alignment=TA_CENTER,
            spaceAfter=14,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Heading1Arial",
            parent=styles["Heading1"],
            fontName="Arial-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#0F766E"),
            spaceBefore=10,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Heading2Arial",
            parent=styles["Heading2"],
            fontName="Arial-Bold",
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#1D4ED8"),
            spaceBefore=8,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Heading3Arial",
            parent=styles["Heading3"],
            fontName="Arial-Bold",
            fontSize=11.5,
            leading=15,
            textColor=colors.HexColor("#334155"),
            spaceBefore=6,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyArial",
            parent=styles["Normal"],
            fontName="Arial",
            fontSize=10.5,
            leading=14.5,
            textColor=colors.HexColor("#111827"),
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BulletArial",
            parent=styles["Normal"],
            fontName="Arial",
            fontSize=10.2,
            leading=14.2,
            leftIndent=14,
            firstLineIndent=0,
            bulletIndent=0,
            spaceAfter=4,
            textColor=colors.HexColor("#0F172A"),
        )
    )
    return styles


def render_story(lines: list[str], styles: StyleSheet1) -> list:
    story: list = []
    for raw_line in lines:
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped:
            story.append(Spacer(1, 4))
            continue

        if stripped.startswith("# "):
            story.append(Paragraph(escape(stripped[2:].strip()), styles["TitleArial"]))
            continue

        if stripped.startswith("## "):
            story.append(Paragraph(escape(stripped[3:].strip()), styles["Heading1Arial"]))
            continue

        if stripped.startswith("### "):
            story.append(Paragraph(escape(stripped[4:].strip()), styles["Heading2Arial"]))
            continue

        if stripped.startswith("#### "):
            story.append(Paragraph(escape(stripped[5:].strip()), styles["Heading3Arial"]))
            continue

        if stripped.startswith("- [ ] "):
            text = stripped[6:].strip()
            story.append(Paragraph(escape(text), styles["BulletArial"], bulletText="□"))
            continue

        if stripped.startswith("- "):
            text = stripped[2:].strip()
            story.append(Paragraph(escape(text), styles["BulletArial"], bulletText="•"))
            continue

        story.append(Paragraph(escape(stripped), styles["BodyArial"]))

    return story


def draw_page(canvas, doc) -> None:
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(colors.HexColor("#CBD5E1"))
    canvas.line(doc.leftMargin, height - 16 * mm, width - doc.rightMargin, height - 16 * mm)
    canvas.setFont("Arial", 9)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(doc.leftMargin, height - 12 * mm, "Checklist mo va van hanh trung tam tieng Anh")
    canvas.drawRightString(width - doc.rightMargin, 12 * mm, f"Trang {canvas.getPageNumber()}")
    canvas.restoreState()


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate opening-center checklist PDF.")
    parser.add_argument("input", nargs="?", default=str(DEFAULT_INPUT))
    parser.add_argument("output", nargs="?", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    register_fonts()
    styles = build_styles()
    lines = input_path.read_text(encoding="utf-8").splitlines()

    story = [
        Paragraph("Ban xuat PDF de su dung trong van hanh", styles["MetaArial"]),
        Spacer(1, 4),
    ]
    story.extend(render_story(lines, styles))

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=22 * mm,
        bottomMargin=18 * mm,
        title="Checklist mo trung tam tieng Anh",
        author="OpenAI Codex",
    )
    doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)


if __name__ == "__main__":
    main()
