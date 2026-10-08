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
SUPPORTED_SUFFIXES = {".txt", ".md", ".py", ".json", ".ipynb", ".html", ".htm", ".docx", ".pdf"}


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
    if suffix == ".pdf":
        return _parse_pdf_text(path)

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


def parse_document_chunks(path: Path, source: str) -> list[Any] | None:
    """Return structured chunks if supported (e.g. PDF), otherwise None."""
    try:
        if not path.is_file() or path.is_symlink() or path.stat().st_size > MAX_FILE_BYTES:
            return None
    except OSError:
        return None

    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return _parse_pdf_structured(path, source)
    return None


def _get_fitz():
    try:
        import pymupdf as fitz
        return fitz
    except ImportError:
        import fitz
        return fitz


def _parse_pdf_text(path: Path) -> str | None:
    fitz = _get_fitz()
    try:
        data = path.read_bytes()
        with fitz.open(stream=data, filetype="pdf") as doc:
            text = "\n".join(page.get_text() for page in doc)
            return text.strip() or None
    except Exception:
        return None

def _parse_pdf_structured(path: Path, source: str) -> list[Any] | None:
    fitz = _get_fitz()
    from .vector_db import DocumentChunk

    chunks = []
    try:
        data = path.read_bytes()
        with fitz.open(stream=data, filetype="pdf") as doc:
            for page_num, page in enumerate(doc, start=1):
                blocks = page.get_text("blocks")
                # blocks is list of (x0, y0, x1, y1, "lines in block", block_no, block_type)
                paragraph_idx = 1
                for block in blocks:
                    if block[6] == 0: # text block
                        text = block[4].strip()
                        if text:
                            chunks.append(DocumentChunk(
                                text=text,
                                source=source,
                                source_type="file",
                                chunk_index=len(chunks),
                                document_id=path.name,
                                page=page_num,
                                paragraph=paragraph_idx,
                                section=None,
                                heading=None
                            ))
                            paragraph_idx += 1
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("PDF parsing failed: %s", e)
        return None
    return chunks if chunks else None


def get_read_only_document_view(path: Path) -> dict[str, Any]:
    """Return a read-only structured representation of a document for safe viewing."""
    if not path.is_file():
        return {"error": "File does not exist.", "is_read_only": True}

    suffix = path.suffix.lower()
    file_info = {
        "filename": path.name,
        "path": str(path),
        "size_bytes": path.stat().st_size,
        "is_read_only": True,
        "suffix": suffix,
        "pages": [],
        "text": "",
    }

    if suffix == ".pdf":
        fitz = _get_fitz()
        try:
            data = path.read_bytes()
            pages = []
            full_text = []
            with fitz.open(stream=data, filetype="pdf") as doc:
                for page_num, page in enumerate(doc, start=1):
                    page_text = page.get_text().strip()
                    full_text.append(f"--- Page {page_num} ---\n{page_text}")
                    pages.append({
                        "page_number": page_num,
                        "text": page_text,
                        "char_count": len(page_text),
                    })
            file_info["pages"] = pages
            file_info["text"] = "\n\n".join(full_text)
            file_info["page_count"] = len(pages)
            return file_info
        except Exception as exc:
            return {"error": f"Failed to render PDF: {exc}", "filename": path.name, "is_read_only": True}

    raw_text = parse_document(path) or ""
    file_info["text"] = raw_text
    file_info["pages"] = [{"page_number": 1, "text": raw_text, "char_count": len(raw_text)}]
    file_info["page_count"] = 1
    return file_info



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
