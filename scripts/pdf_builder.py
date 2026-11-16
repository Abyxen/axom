#!/usr/bin/env python3
"""
AXOM Universal PDF Document Builder
Generates professional, styled PDF documents from Markdown, plain text, or structured JSON.
Uses fpdf2 with modern styling, page numbering, code syntax highlighting, and table support.
"""

import os
import sys
import json
import argparse
import re
from fpdf import FPDF

class AxomPDF(FPDF):
    def __init__(self, doc_title="AXOM Document", author="AXOM Intelligence"):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.doc_title = doc_title
        self.doc_author = author
        self.set_auto_page_break(auto=True, margin=20)
        self.set_margins(18, 18, 18)
        
        # Load system fonts if available
        self.has_custom_font = False
        arial_path = r"C:\Windows\Fonts\arial.ttf"
        arial_bold = r"C:\Windows\Fonts\arialbd.ttf"
        arial_italic = r"C:\Windows\Fonts\ariali.ttf"
        
        try:
            if os.path.exists(arial_path):
                self.add_font("ArialCustom", fname=arial_path)
                self.add_font("ArialCustom", style="B", fname=arial_bold if os.path.exists(arial_bold) else arial_path)
                self.add_font("ArialCustom", style="I", fname=arial_italic if os.path.exists(arial_italic) else arial_path)
                self.has_custom_font = True
        except Exception:
            self.has_custom_font = False

    def get_font_family(self):
        return "ArialCustom" if self.has_custom_font else "Helvetica"

    def header(self):
        if self.page_no() == 1:
            return  # First page has cover/title block
        self.set_font(self.get_font_family(), "I", 8)
        self.set_text_color(130, 140, 150)
        # Clean title
        clean_title = sanitize_text(self.doc_title)[:60]
        self.cell(0, 8, clean_title, align="L")
        self.ln(6)
        self.set_draw_color(220, 225, 230)
        self.set_line_width(0.2)
        self.line(18, self.get_y(), 210 - 18, self.get_y())
        self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_draw_color(220, 225, 230)
        self.set_line_width(0.2)
        self.line(18, self.get_y(), 210 - 18, self.get_y())
        self.ln(2)
        self.set_font(self.get_font_family(), "I", 8)
        self.set_text_color(140, 150, 160)
        self.cell(0, 8, f"AXOM OS • Page {self.page_no()} of {{nb}}", align="C")


def sanitize_text(text):
    if not text:
        return ""
    # Map common smart quotes / typography characters safely
    replacements = {
        '\u2018': "'", '\u2019': "'",
        '\u201c': '"', '\u201d': '"',
        '\u2013': '-', '\u2014': '--',
        '\u2026': '...', '\u2022': '*',
        '\t': '    '
    }
    for orig, rep in replacements.items():
        text = text.replace(orig, rep)
    return text


def build_pdf(content_text, output_path, title="AXOM Generated Document", author="AXOM Intelligence"):
    clean_title = sanitize_text(title)
    pdf = AxomPDF(doc_title=clean_title, author=author)
    pdf.alias_nb_pages()
    pdf.add_page()
    
    font_fam = pdf.get_font_family()

    # Title block on Page 1
    pdf.ln(5)
    pdf.set_fill_color(24, 28, 36)
    pdf.rect(18, pdf.get_y(), 210 - 36, 26, style="F")
    
    pdf.set_y(pdf.get_y() + 4)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font(font_fam, "B", 16)
    pdf.cell(0, 8, clean_title[:55], align="C")
    pdf.ln(9)
    pdf.set_text_color(180, 195, 210)
    pdf.set_font(font_fam, "I", 9)
    pdf.cell(0, 6, f"Generated: 2026 | Author: {author} | AXOM Universal Engine", align="C")
    pdf.ln(15)

    # Process content line by line
    lines = content_text.splitlines()
    in_code_block = False
    code_lines = []

    for line in lines:
        raw_line = sanitize_text(line)
        stripped = raw_line.strip()

        # Code block delimiter
        if stripped.startswith("```"):
            if in_code_block:
                # Render collected code block
                code_text = "\n".join(code_lines)
                pdf.set_font("Courier", size=8.5)
                pdf.set_text_color(40, 45, 55)
                pdf.set_fill_color(244, 246, 248)
                pdf.set_draw_color(210, 215, 225)
                
                # Render code box with multi_cell
                pdf.ln(2)
                pdf.multi_cell(w=0, h=5, text=code_text, border=1, fill=True)
                pdf.ln(3)
                
                code_lines = []
                in_code_block = False
            else:
                in_code_block = True
                code_lines = []
            continue

        if in_code_block:
            code_lines.append(raw_line)
            continue

        # Empty lines
        if not stripped:
            pdf.ln(3)
            continue

        # Headings
        if stripped.startswith("#### "):
            pdf.ln(2)
            pdf.set_font(font_fam, "B", 11)
            pdf.set_text_color(50, 65, 85)
            pdf.multi_cell(0, 6, stripped[5:], markdown=True)
            pdf.ln(1)
        elif stripped.startswith("### "):
            pdf.ln(3)
            pdf.set_font(font_fam, "B", 12)
            pdf.set_text_color(35, 50, 75)
            pdf.multi_cell(0, 7, stripped[4:], markdown=True)
            pdf.ln(1)
        elif stripped.startswith("## "):
            pdf.ln(4)
            pdf.set_font(font_fam, "B", 14)
            pdf.set_text_color(20, 35, 60)
            pdf.multi_cell(0, 8, stripped[3:], markdown=True)
            pdf.set_draw_color(200, 210, 220)
            pdf.line(18, pdf.get_y(), 210 - 18, pdf.get_y())
            pdf.ln(2)
        elif stripped.startswith("# "):
            pdf.ln(5)
            pdf.set_font(font_fam, "B", 16)
            pdf.set_text_color(15, 25, 45)
            pdf.multi_cell(0, 9, stripped[2:], markdown=True)
            pdf.set_draw_color(100, 130, 180)
            pdf.set_line_width(0.4)
            pdf.line(18, pdf.get_y(), 210 - 18, pdf.get_y())
            pdf.set_line_width(0.2)
            pdf.ln(3)
        elif stripped.startswith("---") or stripped.startswith("***"):
            pdf.ln(2)
            pdf.set_draw_color(210, 215, 225)
            pdf.line(18, pdf.get_y(), 210 - 18, pdf.get_y())
            pdf.ln(3)
        elif stripped.startswith("* ") or stripped.startswith("- "):
            bullet_text = stripped[2:]
            pdf.set_font(font_fam, "", 10)
            pdf.set_text_color(40, 45, 50)
            # Indented bullet point
            pdf.set_x(24)
            pdf.multi_cell(0, 6, f"-  {bullet_text}", markdown=True)
        elif re.match(r"^\d+\.\s+", stripped):
            num_match = re.match(r"^(\d+\.\s+)(.*)", stripped)
            prefix = num_match.group(1)
            body = num_match.group(2)
            pdf.set_font(font_fam, "", 10)
            pdf.set_text_color(40, 45, 50)
            pdf.set_x(24)
            pdf.multi_cell(0, 6, f"{prefix}{body}", markdown=True)
        else:
            # Standard body paragraph
            pdf.set_font(font_fam, "", 10)
            pdf.set_text_color(45, 50, 55)
            pdf.multi_cell(0, 6, stripped, markdown=True)
            pdf.ln(1)

    # Flush any trailing code block
    if in_code_block and code_lines:
        code_text = "\n".join(code_lines)
        pdf.set_font("Courier", size=8.5)
        pdf.set_text_color(40, 45, 55)
        pdf.set_fill_color(244, 246, 248)
        pdf.set_draw_color(210, 215, 225)
        pdf.ln(2)
        pdf.multi_cell(w=0, h=5, text=code_text, border=1, fill=True)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    pdf.output(output_path)
    
    file_size = os.path.getsize(output_path)
    return {
        "success": True,
        "path": output_path,
        "bytes": file_size,
        "title": clean_title,
        "pages": pdf.page_no()
    }


def main():
    parser = argparse.ArgumentParser(description="AXOM Universal PDF Builder")
    parser.add_argument("--output", "-o", help="Destination PDF file path")
    parser.add_argument("--input", "-i", help="Path to input text or markdown file")
    parser.add_argument("--content", "-c", help="Direct text/markdown content string")
    parser.add_argument("--title", "-t", default="AXOM Generated Document", help="Document title")
    parser.add_argument("--author", "-a", default="AXOM Intelligence", help="Document author")
    parser.add_argument("--json", help="Path to JSON payload with {content, output, title, author}")

    args = parser.parse_args()

    content = ""
    output_path = args.output
    title = args.title
    author = args.author

    if args.json:
        with open(args.json, "r", encoding="utf-8") as f:
            data = json.load(f)
            content = data.get("content", "")
            output_path = data.get("output", output_path)
            title = data.get("title", title)
            author = data.get("author", author)
    elif args.input:
        with open(args.input, "r", encoding="utf-8") as f:
            content = f.read()
    elif args.content:
        content = args.content
    else:
        content = sys.stdin.read()

    if not output_path:
        print(json.dumps({"success": False, "error": "Destination output path must be specified via --output or in --json"}))
        sys.exit(1)

    res = build_pdf(content, output_path, title=title, author=author)
    print(json.dumps(res))

if __name__ == "__main__":
    main()
