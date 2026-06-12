"""Chroma vector store wrapper (singleton)."""
import logging
from functools import lru_cache

from langchain_chroma import Chroma
from langchain_core.documents import Document as LCDocument
from langchain_openai import OpenAIEmbeddings

from app.config import get_settings

logger = logging.getLogger(__name__)


class VectorStoreService:
    def __init__(self) -> None:
        settings = get_settings()
        self._embeddings = OpenAIEmbeddings(
            model=settings.embedding_model,
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        )
        self._store = Chroma(
            collection_name=settings.chroma_collection,
            embedding_function=self._embeddings,
            persist_directory=str(settings.chroma_dir),
            collection_metadata={"hnsw:space": "cosine"},
        )

    def add_chunks(self, chunks: list[LCDocument], ids: list[str]) -> None:
        self._store.add_documents(documents=chunks, ids=ids)

    def delete_document(self, document_id: str) -> None:
        self._store.delete(where={"document_id": document_id})

    def search_with_scores(
        self, query: str, k: int
    ) -> list[tuple[LCDocument, float]]:
        """Returns (chunk, cosine_distance) pairs — lower distance = more similar."""
        return self._store.similarity_search_with_score(query, k=k)

    def get_chunk(self, chunk_id: str) -> LCDocument | None:
        result = self._store.get(ids=[chunk_id], include=["documents", "metadatas"])
        if not result["ids"]:
            return None
        return LCDocument(
            page_content=result["documents"][0],
            metadata=result["metadatas"][0] or {},
        )

    def count(self) -> int:
        return self._store._collection.count()


@lru_cache
def get_vector_store() -> VectorStoreService:
    return VectorStoreService()
