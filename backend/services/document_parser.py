"""Safe, dependency-light extraction for the document formats advertised by the app."""

from __future__ import annotations

import json
import os
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from bs4 import BeautifulSoup


MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_DOCX_XML_BYTES = 10 * 1024 * 1024
SUPPORTED_SUFFIXES = {".txt", ".md", ".py", ".json", ".ipynb", ".html", ".htm", ".docx"}


def is_supported_document(path: Path) -> bool:
    return path.suffix.lower() in SUPPORTED_SUFFIXES


def parse_document(path: Path) -> str | None:
    """Extract readable text from a supported file, returning None when skipped.

    The caller can safely continue indexing if a corrupt, binary, too-large, or
    unsupported file is encountered.
    """
    try:
        if not path.is_file() or path.is_symlink() or path.stat().st_size > MAX_FILE_BYTES:
            return None
    except OSError:
        return None

    suffix = path.suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        return None

    if suffix == ".docx":
        return _parse_docx(path)

    try:
        raw = path.read_bytes()
    except OSError:
        return None

    # A NUL byte is a useful inexpensive indicator that a regular text file is
    # actually binary data.
    if b"\x00" in raw:
        return None

    text = raw.decode("utf-8-sig", errors="ignore").strip()
    if not text:
        return None

    if suffix in {".html", ".htm"}:
        return _html_to_text(text)
    if suffix == ".ipynb":
        return _notebook_to_text(text)
    return text


def _html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for element in soup(["script", "style", "noscript", "template", "svg"]):
        element.decompose()
    return " ".join(soup.get_text(" ", strip=True).split())


def _notebook_to_text(notebook_json: str) -> str | None:
    try:
        notebook = json.loads(notebook_json)
    except json.JSONDecodeError:
        return None

    cells = notebook.get("cells")
    if not isinstance(cells, list):
        return None

    extracted_cells: list[str] = []
    for cell in cells:
        if not isinstance(cell, dict):
            continue
        source = cell.get("source", "")
        if isinstance(source, list):
            source = "".join(str(line) for line in source)
        if not isinstance(source, str) or not source.strip():
            continue
        cell_type = cell.get("cell_type", "cell")
        extracted_cells.append(f"[{cell_type}]\n{source.strip()}")

    return "\n\n".join(extracted_cells).strip() or None


def _parse_docx(path: Path) -> str | None:
    """Extract paragraph text from a DOCX archive without requiring python-docx."""
    namespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    ns = {"w": namespace}

    try:
        with zipfile.ZipFile(path) as archive:
            info = archive.getinfo("word/document.xml")
            if info.file_size > MAX_DOCX_XML_BYTES:
                return None
            document_xml = archive.read("word/document.xml")
        root = ET.fromstring(document_xml)
    except (OSError, KeyError, ET.ParseError, zipfile.BadZipFile, zipfile.LargeZipFile):
        return None

    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:p", ns):
        pieces: list[str] = []
        for node in paragraph.iter():
            if node.tag == f"{{{namespace}}}t" and node.text:
                pieces.append(node.text)
            elif node.tag == f"{{{namespace}}}tab":
                pieces.append("\t")
            elif node.tag in {f"{{{namespace}}}br", f"{{{namespace}}}cr"}:
                pieces.append("\n")
        paragraph_text = "".join(pieces).strip()
        if paragraph_text:
            paragraphs.append(paragraph_text)

    return "\n".join(paragraphs).strip() or None
