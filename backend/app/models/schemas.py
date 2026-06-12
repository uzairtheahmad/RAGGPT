"""Pydantic schemas for the API layer."""
from datetime import datetime

from pydantic import BaseModel, Field


class SourceCitation(BaseModel):
    source_file: str
    page: int | str | None = None
    section: str | None = None
    chunk_id: str
    snippet: str = ""


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    sources: list[SourceCitation] = []
    created_at: datetime


class ChatSummary(BaseModel):
    chat_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class ChatDetail(BaseModel):
    chat_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[MessageOut] = []


class ChatCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class ChatRename(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class SendMessage(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class DocumentOut(BaseModel):
    id: str
    filename: str
    file_type: str
    size_bytes: int
    chunk_count: int
    status: str
    error: str | None = None
    created_at: datetime


class UploadResult(BaseModel):
    uploaded: list[DocumentOut] = []
    failed: list[dict] = []


class ChunkOut(BaseModel):
    chunk_id: str
    content: str
    source_file: str
    page: int | str | None = None
    section: str | None = None
