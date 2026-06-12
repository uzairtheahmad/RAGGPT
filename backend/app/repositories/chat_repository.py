"""Data access for chats and messages."""
import json

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.db_models import Chat, Message


class ChatRepository:
    def __init__(self, db: Session):
        self.db = db

    # --- Chats ---

    def create_chat(self, title: str | None = None) -> Chat:
        chat = Chat(title=title or "New chat")
        self.db.add(chat)
        self.db.commit()
        self.db.refresh(chat)
        return chat

    def get_chat(self, chat_id: str) -> Chat | None:
        return self.db.get(Chat, chat_id)

    def list_chats(self) -> list[tuple[Chat, int]]:
        stmt = (
            select(Chat, func.count(Message.id))
            .outerjoin(Message, Message.chat_id == Chat.id)
            .group_by(Chat.id)
            .order_by(Chat.updated_at.desc())
        )
        return [(chat, count) for chat, count in self.db.execute(stmt)]

    def rename_chat(self, chat: Chat, title: str) -> Chat:
        chat.title = title
        self.db.commit()
        self.db.refresh(chat)
        return chat

    def delete_chat(self, chat: Chat) -> None:
        self.db.delete(chat)
        self.db.commit()

    def touch(self, chat: Chat) -> None:
        # updated_at refreshes via onupdate when any column changes
        chat.title = chat.title
        self.db.commit()

    # --- Messages ---

    def add_message(
        self,
        chat: Chat,
        role: str,
        content: str,
        sources: list[dict] | None = None,
    ) -> Message:
        message = Message(
            chat_id=chat.id,
            role=role,
            content=content,
            sources_json=json.dumps(sources) if sources else None,
        )
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message

    def get_history(self, chat: Chat, limit: int | None = None) -> list[Message]:
        messages = list(chat.messages)
        return messages[-limit:] if limit else messages
