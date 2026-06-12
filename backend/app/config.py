"""Application configuration loaded from environment variables / .env file."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
DATA_DIR = BASE_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- OpenAI / LLM ---
    openai_api_key: str = ""
    openai_base_url: str | None = None
    chat_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"
    llm_temperature: float = 0.0

    # --- Storage ---
    data_dir: Path = DATA_DIR
    sqlite_path: Path = DATA_DIR / "app.db"
    chroma_dir: Path = DATA_DIR / "chroma"
    upload_dir: Path = DATA_DIR / "uploads"
    chroma_collection: str = "documents"

    # --- Ingestion ---
    max_file_size_mb: int = 25
    chunk_size: int = 1000
    chunk_overlap: int = 150

    # --- Retrieval ---
    top_k: int = 6
    fetch_k: int = 20                # candidates fetched before compression
    relevance_distance_threshold: float = 0.78  # cosine distance; higher = less related
    max_context_chars: int = 12000   # context compression budget
    history_window: int = 10         # messages of chat history given to the LLM

    # --- API ---
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    def ensure_dirs(self) -> None:
        for d in (self.data_dir, self.chroma_dir, self.upload_dir):
            d.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_dirs()
    return settings
