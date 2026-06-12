"""Document upload / listing / deletion / chunk inspection endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.loaders import SUPPORTED_EXTENSIONS
from app.models.db_models import Document
from app.models.schemas import ChunkOut, DocumentOut, UploadResult
from app.repositories.document_repository import DocumentRepository
from app.services.ingestion_service import IngestionError, IngestionService
from app.services.vector_store import get_vector_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])


def _document_out(doc: Document) -> DocumentOut:
    return DocumentOut(
        id=doc.id,
        filename=doc.filename,
        file_type=doc.file_type,
        size_bytes=doc.size_bytes,
        chunk_count=doc.chunk_count,
        status=doc.status,
        error=doc.error,
        created_at=doc.created_at,
    )


@router.get("", response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db)) -> list[DocumentOut]:
    return [_document_out(d) for d in DocumentRepository(db).list_all()]


@router.get("/supported-types")
def supported_types() -> dict:
    return {"extensions": sorted(SUPPORTED_EXTENSIONS)}


@router.post("", response_model=UploadResult)
async def upload_documents(
    files: list[UploadFile], db: Session = Depends(get_db)
) -> UploadResult:
    """Upload one or more documents. Partial failures are reported, not fatal."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    service = IngestionService(db)
    result = UploadResult()
    for upload in files:
        try:
            doc = await service.ingest_upload(upload)
            result.uploaded.append(_document_out(doc))
        except IngestionError as exc:
            result.failed.append({"filename": upload.filename or "unknown", "error": str(exc)})
        except Exception:
            logger.exception("Unexpected upload error for %s", upload.filename)
            result.failed.append(
                {
                    "filename": upload.filename or "unknown",
                    "error": "Unexpected error while processing this file.",
                }
            )
    return result


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: str, db: Session = Depends(get_db)) -> None:
    if not IngestionService(db).delete_document(document_id):
        raise HTTPException(status_code=404, detail="Document not found")


@router.get("/chunks/{chunk_id}", response_model=ChunkOut)
def get_chunk(chunk_id: str) -> ChunkOut:
    """Inspect a cited chunk (used by the 'view source' UI)."""
    chunk = get_vector_store().get_chunk(chunk_id)
    if chunk is None:
        raise HTTPException(status_code=404, detail="Chunk not found")
    metadata = chunk.metadata or {}
    return ChunkOut(
        chunk_id=chunk_id,
        content=chunk.page_content,
        source_file=str(metadata.get("source_file", "unknown")),
        page=metadata.get("page") or None,
        section=str(metadata.get("section") or "") or None,
    )
