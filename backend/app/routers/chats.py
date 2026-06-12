"""Chat session + messaging endpoints."""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.database import get_db
from app.models.db_models import Chat, Message
from app.models.schemas import (
    ChatCreate,
    ChatDetail,
    ChatRename,
    ChatSummary,
    MessageOut,
    SendMessage,
)
from app.repositories.chat_repository import ChatRepository
from app.services.chat_service import ChatService

router = APIRouter(prefix="/api/chats", tags=["chats"])


def _message_out(message: Message) -> MessageOut:
    sources = json.loads(message.sources_json) if message.sources_json else []
    return MessageOut(
        id=message.id,
        role=message.role,
        content=message.content,
        sources=sources,
        created_at=message.created_at,
    )


def _get_chat_or_404(chat_id: str, db: Session) -> Chat:
    chat = ChatRepository(db).get_chat(chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.get("", response_model=list[ChatSummary])
def list_chats(db: Session = Depends(get_db)) -> list[ChatSummary]:
    return [
        ChatSummary(
            chat_id=chat.id,
            title=chat.title,
            created_at=chat.created_at,
            updated_at=chat.updated_at,
            message_count=count,
        )
        for chat, count in ChatRepository(db).list_chats()
    ]


@router.post("", response_model=ChatSummary, status_code=201)
def create_chat(payload: ChatCreate, db: Session = Depends(get_db)) -> ChatSummary:
    chat = ChatRepository(db).create_chat(payload.title)
    return ChatSummary(
        chat_id=chat.id,
        title=chat.title,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        message_count=0,
    )


@router.get("/{chat_id}", response_model=ChatDetail)
def get_chat(chat_id: str, db: Session = Depends(get_db)) -> ChatDetail:
    chat = _get_chat_or_404(chat_id, db)
    return ChatDetail(
        chat_id=chat.id,
        title=chat.title,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        messages=[_message_out(m) for m in chat.messages],
    )


@router.patch("/{chat_id}", response_model=ChatSummary)
def rename_chat(
    chat_id: str, payload: ChatRename, db: Session = Depends(get_db)
) -> ChatSummary:
    chat = _get_chat_or_404(chat_id, db)
    chat = ChatRepository(db).rename_chat(chat, payload.title.strip())
    return ChatSummary(
        chat_id=chat.id,
        title=chat.title,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        message_count=len(chat.messages),
    )


@router.delete("/{chat_id}", status_code=204)
def delete_chat(chat_id: str, db: Session = Depends(get_db)) -> None:
    chat = _get_chat_or_404(chat_id, db)
    ChatRepository(db).delete_chat(chat)


@router.post("/{chat_id}/messages")
async def send_message(
    chat_id: str, payload: SendMessage, db: Session = Depends(get_db)
):
    """Send a user message; the grounded answer is streamed back as SSE."""
    _get_chat_or_404(chat_id, db)  # validate before opening the stream
    service = ChatService()  # owns its own DB session (outlives this request scope)
    return EventSourceResponse(
        service.stream_response(chat_id, payload.content.strip()),
        ping=15,
    )
