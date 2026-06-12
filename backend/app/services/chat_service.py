"""Chat orchestration: persistence + RAG + SSE event stream."""
import json
import logging
from collections.abc import AsyncGenerator

from app.config import get_settings
from app.database import SessionLocal
from app.models.db_models import Chat
from app.repositories.chat_repository import ChatRepository
from app.services.rag_service import NOT_FOUND_ANSWER, get_rag_service

logger = logging.getLogger(__name__)


def sse_event(event: str, data: dict | str) -> dict:
    return {"event": event, "data": json.dumps(data) if isinstance(data, dict) else data}


class ChatService:
    """Owns its own DB session: the SSE generator outlives the request-scoped
    session FastAPI dependencies provide, so it cannot reuse that one."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.rag = get_rag_service()

    async def stream_response(
        self, chat_id: str, user_content: str
    ) -> AsyncGenerator[dict, None]:
        """Yields SSE events: user_message, title, token*, sources, done | error."""
        db = SessionLocal()
        try:
            repo = ChatRepository(db)
            chat = repo.get_chat(chat_id)
            if chat is None:
                yield sse_event("error", {"message": "Chat not found."})
                return
            async for event in self._stream(repo, chat, user_content):
                yield event
        finally:
            db.close()

    async def _stream(
        self, repo: ChatRepository, chat: Chat, user_content: str
    ) -> AsyncGenerator[dict, None]:
        history = [
            (m.role, m.content)
            for m in repo.get_history(chat, limit=self.settings.history_window)
        ]
        is_first_message = len(history) == 0

        user_message = repo.add_message(chat, "user", user_content)
        yield sse_event(
            "user_message",
            {"id": user_message.id, "created_at": user_message.created_at.isoformat()},
        )

        try:
            # Auto-title the chat from the first message
            if is_first_message and chat.title == "New chat":
                title = await self.rag.generate_title(user_content)
                repo.rename_chat(chat, title)
                yield sse_event("title", {"chat_id": chat.id, "title": title})

            standalone = await self.rag.condense_question(user_content, history)
            result = self.rag.retrieve(standalone)

            if result.direct_answer is not None:
                assistant = repo.add_message(chat, "assistant", result.direct_answer)
                yield sse_event("token", {"t": result.direct_answer})
                yield sse_event("sources", {"sources": []})
                yield sse_event(
                    "done",
                    {
                        "message_id": assistant.id,
                        "created_at": assistant.created_at.isoformat(),
                    },
                )
                return

            chunks = result.chunks or []
            answer_parts: list[str] = []
            async for token in self.rag.stream_answer(user_content, chunks, history):
                answer_parts.append(token)
                yield sse_event("token", {"t": token})

            answer = "".join(answer_parts).strip()

            # Only cite sources when the model actually answered from them.
            citations = (
                []
                if answer.startswith(NOT_FOUND_ANSWER)
                else self._dedupe_citations([c.to_citation() for c in chunks])
            )
            assistant = repo.add_message(chat, "assistant", answer, citations)
            yield sse_event("sources", {"sources": citations})
            yield sse_event(
                "done",
                {
                    "message_id": assistant.id,
                    "created_at": assistant.created_at.isoformat(),
                },
            )
        except Exception:
            logger.exception("Chat streaming failed for chat %s", chat.id)
            yield sse_event(
                "error",
                {"message": "Something went wrong while generating the response. Please try again."},
            )

    @staticmethod
    def _dedupe_citations(citations: list[dict]) -> list[dict]:
        seen: set[tuple] = set()
        unique = []
        for citation in citations:
            key = (citation["source_file"], citation.get("page"), citation.get("section"))
            if key not in seen:
                seen.add(key)
                unique.append(citation)
        return unique
