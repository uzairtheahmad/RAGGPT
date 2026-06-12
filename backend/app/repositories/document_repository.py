"""Data access for document metadata."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.db_models import Document


class DocumentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, **kwargs) -> Document:
        doc = Document(**kwargs)
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)
        return doc

    def get(self, document_id: str) -> Document | None:
        return self.db.get(Document, document_id)

    def list_all(self) -> list[Document]:
        stmt = select(Document).order_by(Document.created_at.desc())
        return list(self.db.scalars(stmt))

    def list_ready(self) -> list[Document]:
        stmt = select(Document).where(Document.status == "ready")
        return list(self.db.scalars(stmt))

    def update(self, doc: Document, **kwargs) -> Document:
        for key, value in kwargs.items():
            setattr(doc, key, value)
        self.db.commit()
        self.db.refresh(doc)
        return doc

    def delete(self, doc: Document) -> None:
        self.db.delete(doc)
        self.db.commit()
