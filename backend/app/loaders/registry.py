"""File-type detection: maps an extension to the right loader instance."""
from pathlib import Path

from app.loaders.base import BaseDocumentLoader, UnsupportedFileTypeError
from app.loaders.loaders import (
    CodeLoader,
    CsvLoader,
    DocxLoader,
    ExcelLoader,
    HtmlLoader,
    JsonLoader,
    MarkdownLoader,
    PdfLoader,
    PptxLoader,
    TextLoader,
    XmlLoader,
)

_LOADERS: list[BaseDocumentLoader] = [
    PdfLoader(),
    TextLoader(),
    MarkdownLoader(),
    CsvLoader(),
    ExcelLoader(),
    DocxLoader(),
    PptxLoader(),
    JsonLoader(),
    XmlLoader(),
    HtmlLoader(),
    CodeLoader(),
]

_REGISTRY: dict[str, BaseDocumentLoader] = {
    ext: loader for loader in _LOADERS for ext in loader.extensions
}

SUPPORTED_EXTENSIONS: frozenset[str] = frozenset(_REGISTRY)


def get_loader_for(file_path: str | Path) -> BaseDocumentLoader:
    ext = Path(file_path).suffix.lower()
    loader = _REGISTRY.get(ext)
    if loader is None:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise UnsupportedFileTypeError(
            f"Unsupported file type '{ext or '(none)'}'. Supported types: {supported}"
        )
    return loader
