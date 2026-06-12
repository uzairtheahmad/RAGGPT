"""Document ingestion: validate -> store -> load -> chunk -> embed -> index."""
import logging
import re
import uuid
from pathlib import Path

from fastapi import UploadFile
from langchain_core.documents import Document as LCDocument
from langchain_text_splitters import (
    Language,
    RecursiveCharacterTextSplitter,
)
from sqlalchemy.orm import Session

from app.config import get_settings
from app.loaders import SUPPORTED_EXTENSIONS, get_loader_for
from app.loaders.base import DocumentLoadError
from app.models.db_models import Document
from app.repositories.document_repository import DocumentRepository
from app.services.vector_store import get_vector_store

logger = logging.getLogger(__name__)

# Map our code-file languages onto LangChain's syntax-aware splitters.
_SPLITTER_LANGUAGES: dict[str, Language] = {
    "python": Language.PYTHON,
    "javascript": Language.JS,
    "typescript": Language.TS,
    "java": Language.JAVA,
    "cpp": Language.CPP,
    "c": Language.C,
    "go": Language.GO,
    "rust": Language.RUST,
    "php": Language.PHP,
    "ruby": Language.RUBY,
    "swift": Language.SWIFT,
    "kotlin": Language.KOTLIN,
    "csharp": Language.CSHARP,
    "scala": Language.SCALA,
    "lua": Language.LUA,
    "markdown": Language.MARKDOWN,
    "html": Language.HTML,
}


class IngestionError(Exception):
    """User-facing ingestion failure."""


def sanitize_filename(filename: str) -> str:
    name = Path(filename or "upload").name  # strip any path components
    name = re.sub(r"[^\w.\- ()\[\]]", "_", name)
    return name[:200] or "upload"


class IngestionService:
    def __init__(self, db: Session):
        self.settings = get_settings()
        self.repo = DocumentRepository(db)
        self.vector_store = get_vector_store()

    def _build_splitter(self, language: str | None) -> RecursiveCharacterTextSplitter:
        if language and language in _SPLITTER_LANGUAGES:
            return RecursiveCharacterTextSplitter.from_language(
                _SPLITTER_LANGUAGES[language],
                chunk_size=self.settings.chunk_size,
                chunk_overlap=self.settings.chunk_overlap,
            )
        return RecursiveCharacterTextSplitter(
            chunk_size=self.settings.chunk_size,
            chunk_overlap=self.settings.chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    async def ingest_upload(self, upload: UploadFile) -> Document:
        filename = sanitize_filename(upload.filename or "upload")
        ext = Path(filename).suffix.lower()

        if ext not in SUPPORTED_EXTENSIONS:
            supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
            raise IngestionError(
                f"'{filename}' has an unsupported file type. Supported: {supported}"
            )

        raw = await upload.read()
        max_bytes = self.settings.max_file_size_mb * 1024 * 1024
        if len(raw) > max_bytes:
            raise IngestionError(
                f"'{filename}' exceeds the {self.settings.max_file_size_mb} MB size limit."
            )
        if not raw:
            raise IngestionError(f"'{filename}' is empty.")

        # Persist the original file
        document_id = uuid.uuid4().hex
        stored_path = self.settings.upload_dir / f"{document_id}_{filename}"
        stored_path.write_bytes(raw)

        doc = self.repo.create(
            id=document_id,
            filename=filename,
            stored_path=str(stored_path),
            file_type=ext.lstrip("."),
            size_bytes=len(raw),
            status="processing",
        )

        try:
            chunk_count = self._index_file(document_id, filename, stored_path)
            if chunk_count == 0:
                raise IngestionError(
                    f"No readable text could be extracted from '{filename}'."
                )
            return self.repo.update(doc, status="ready", chunk_count=chunk_count, error=None)
        except (IngestionError, DocumentLoadError) as exc:
            logger.warning("Ingestion failed for %s: %s", filename, exc)
            self._cleanup_failed(doc, stored_path)
            raise IngestionError(str(exc)) from exc
        except Exception as exc:  # never crash on malformed files
            logger.exception("Unexpected ingestion error for %s", filename)
            self._cleanup_failed(doc, stored_path)
            raise IngestionError(
                f"'{filename}' could not be processed ({type(exc).__name__})."
            ) from exc

    def _cleanup_failed(self, doc: Document, stored_path: Path) -> None:
        try:
            self.vector_store.delete_document(doc.id)
        except Exception:
            pass
        stored_path.unlink(missing_ok=True)
        self.repo.delete(doc)

    def _index_file(self, document_id: str, filename: str, path: Path) -> int:
        loader = get_loader_for(path)
        segments = loader.load(path)

        chunks: list[LCDocument] = []
        ids: list[str] = []
        chunk_index = 0
        for segment in segments:
            language = segment.extra.get("language")
            splitter = self._build_splitter(language)
            for piece in splitter.split_text(segment.content):
                piece = piece.strip()
                if not piece:
                    continue
                chunk_id = f"{document_id}:{chunk_index}"
                metadata = {
                    "document_id": document_id,
                    "source_file": filename,
                    "chunk_id": chunk_id,
                    "page": segment.page if segment.page is not None else "",
                    "section": segment.section or "",
                }
                chunks.append(LCDocument(page_content=piece, metadata=metadata))
                ids.append(chunk_id)
                chunk_index += 1

        # Embed in batches to keep request sizes reasonable
        BATCH = 64
        for start in range(0, len(chunks), BATCH):
            self.vector_store.add_chunks(chunks[start : start + BATCH], ids[start : start + BATCH])

        logger.info("Indexed %s -> %d chunks", filename, len(chunks))
        return len(chunks)

    def delete_document(self, document_id: str) -> bool:
        doc = self.repo.get(document_id)
        if doc is None:
            return False
        try:
            self.vector_store.delete_document(document_id)
        except Exception:
            logger.exception("Failed to delete vectors for %s", document_id)
        Path(doc.stored_path).unlink(missing_ok=True)
        self.repo.delete(doc)
        return True
