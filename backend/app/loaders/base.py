"""Document loader abstraction.

Every loader turns a file into a list of LoadedSegment objects — logical units
of text (a PDF page, an Excel sheet, a slide, ...) with metadata that is later
preserved on every chunk for source citations.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path


class DocumentLoadError(Exception):
    """Raised when a file cannot be parsed. Always caught — never crashes the app."""


class UnsupportedFileTypeError(DocumentLoadError):
    """Raised when no loader exists for a file extension."""


@dataclass
class LoadedSegment:
    content: str
    page: int | str | None = None       # page number, sheet name, slide number...
    section: str | None = None          # heading / sheet / slide title
    extra: dict = field(default_factory=dict)


class BaseDocumentLoader(ABC):
    """Base class for all document loaders."""

    #: extensions this loader handles, lowercase with dot ('.pdf')
    extensions: tuple[str, ...] = ()

    @abstractmethod
    def load(self, file_path: str | Path) -> list[LoadedSegment]:
        """Parse the file and return its text segments. Raises DocumentLoadError."""

    def _read_bytes(self, file_path: str | Path) -> bytes:
        try:
            return Path(file_path).read_bytes()
        except OSError as exc:
            raise DocumentLoadError(f"Could not read file: {exc}") from exc


def decode_text(raw: bytes) -> str:
    """Best-effort text decoding with charset detection fallback."""
    for encoding in ("utf-8", "utf-16"):
        try:
            return raw.decode(encoding)
        except (UnicodeDecodeError, ValueError):
            continue
    try:
        import chardet

        detected = chardet.detect(raw)
        if detected.get("encoding"):
            return raw.decode(detected["encoding"], errors="replace")
    except Exception:
        pass
    return raw.decode("utf-8", errors="replace")
