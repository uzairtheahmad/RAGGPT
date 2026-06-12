"""RAG pipeline: relevance guard -> history-aware retrieval -> grounded streaming answer.

Flow for every user question:
  1. Condense the question with chat history into a standalone query
     (conversation memory: "what about profit?" -> "what is the company profit?").
  2. Retrieve top candidates from Chroma with cosine distances.
  3. Relevance guard: if the best distance is above the threshold, the question
     is unrelated to the uploaded documents -> polite rejection, no LLM answer.
  4. Compress context to a character budget, keeping the most similar chunks.
  5. Stream a strictly grounded answer; the model is instructed to use the
     fixed fallback sentence when the context does not contain the answer.
"""
import logging
from collections.abc import AsyncGenerator
from dataclasses import dataclass

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.documents import Document as LCDocument
from langchain_openai import ChatOpenAI

from app.config import get_settings
from app.services.vector_store import get_vector_store

logger = logging.getLogger(__name__)

NOT_FOUND_ANSWER = (
    "I could not find information related to that question in the uploaded documents."
)
OFF_TOPIC_ANSWER = (
    "This question does not appear to be related to the uploaded documents. "
    "Please ask questions based on the available documents."
)
NO_DOCUMENTS_ANSWER = (
    "There are no documents in the knowledge base yet. "
    "Please upload one or more documents and ask again."
)

SYSTEM_PROMPT = """You are a document assistant. You answer questions using ONLY the document excerpts provided in the CONTEXT section below. You have no other knowledge.

Strict rules:
1. Answer ONLY with information stated in the CONTEXT. Never use outside or general world knowledge.
2. If the CONTEXT does not contain the information needed to answer, reply with exactly this sentence and nothing else:
"{not_found}"
3. Never invent, guess, or extrapolate facts that are not explicitly in the CONTEXT.
4. When you answer, be clear and well-structured. Use Markdown formatting when helpful.
5. You may use the conversation history only to understand what the user is referring to (e.g. pronouns or follow-ups), never as a source of facts.
6. Mention which document the information comes from when it adds clarity (e.g. "According to report.pdf...").

CONTEXT:
{context}"""

CONDENSE_PROMPT = """Given the conversation history and a follow-up question, rewrite the follow-up as a single standalone question that contains all context needed to search a document database. Keep it in the same language. If the question is already standalone, return it unchanged. Return ONLY the rewritten question, nothing else.

Conversation history:
{history}

Follow-up question: {question}

Standalone question:"""


@dataclass
class RetrievedChunk:
    content: str
    source_file: str
    page: int | str | None
    section: str | None
    chunk_id: str
    distance: float

    def to_citation(self) -> dict:
        snippet = self.content[:300] + ("…" if len(self.content) > 300 else "")
        return {
            "source_file": self.source_file,
            "page": self.page if self.page not in ("", None) else None,
            "section": self.section or None,
            "chunk_id": self.chunk_id,
            "snippet": snippet,
        }


@dataclass
class RagResult:
    """Yields either a direct (guarded) answer or a streaming generator setup."""
    direct_answer: str | None = None
    chunks: list[RetrievedChunk] | None = None


class RagService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.vector_store = get_vector_store()
        self._llm = ChatOpenAI(
            model=self.settings.chat_model,
            temperature=self.settings.llm_temperature,
            api_key=self.settings.openai_api_key,
            base_url=self.settings.openai_base_url,
            streaming=True,
        )

    # ------------------------------------------------------------------ #
    # Conversation memory: condense follow-ups into standalone questions  #
    # ------------------------------------------------------------------ #
    async def condense_question(
        self, question: str, history: list[tuple[str, str]]
    ) -> str:
        if not history:
            return question
        history_text = "\n".join(
            f"{'User' if role == 'user' else 'Assistant'}: {content[:500]}"
            for role, content in history[-6:]
        )
        try:
            response = await self._llm.ainvoke(
                [
                    HumanMessage(
                        content=CONDENSE_PROMPT.format(
                            history=history_text, question=question
                        )
                    )
                ]
            )
            condensed = (response.content or "").strip()
            if condensed:
                logger.info("Condensed question: %r -> %r", question, condensed)
                return condensed
        except Exception:
            logger.exception("Question condensing failed; using original question")
        return question

    # ------------------------------------------------------------------ #
    # Retrieval + relevance guard + context compression                    #
    # ------------------------------------------------------------------ #
    def retrieve(self, query: str) -> RagResult:
        try:
            if self.vector_store.count() == 0:
                return RagResult(direct_answer=NO_DOCUMENTS_ANSWER)
        except Exception:
            logger.exception("Vector store count failed")

        results = self.vector_store.search_with_scores(query, k=self.settings.fetch_k)
        if not results:
            return RagResult(direct_answer=NOT_FOUND_ANSWER)

        best_distance = min(distance for _, distance in results)
        if best_distance > self.settings.relevance_distance_threshold:
            # Relevance guard: nothing in the knowledge base is close enough.
            logger.info(
                "Relevance guard rejected query (best distance %.3f > %.3f): %r",
                best_distance,
                self.settings.relevance_distance_threshold,
                query,
            )
            return RagResult(direct_answer=OFF_TOPIC_ANSWER)

        chunks = self._compress(results)
        return RagResult(chunks=chunks)

    def _compress(
        self, results: list[tuple[LCDocument, float]]
    ) -> list[RetrievedChunk]:
        """Keep the most similar chunks within top_k and the character budget."""
        results = sorted(results, key=lambda pair: pair[1])[: self.settings.top_k]
        selected: list[RetrievedChunk] = []
        budget = self.settings.max_context_chars
        for doc, distance in results:
            content = doc.page_content
            if budget - len(content) < 0 and selected:
                continue
            metadata = doc.metadata or {}
            selected.append(
                RetrievedChunk(
                    content=content[: max(budget, 500)],
                    source_file=str(metadata.get("source_file", "unknown")),
                    page=metadata.get("page") or None,
                    section=str(metadata.get("section") or "") or None,
                    chunk_id=str(metadata.get("chunk_id", "")),
                    distance=float(distance),
                )
            )
            budget -= len(content)
        return selected

    # ------------------------------------------------------------------ #
    # Grounded streaming generation                                        #
    # ------------------------------------------------------------------ #
    def _format_context(self, chunks: list[RetrievedChunk]) -> str:
        blocks = []
        for i, chunk in enumerate(chunks, start=1):
            location = chunk.source_file
            if chunk.page not in (None, ""):
                location += f", page {chunk.page}"
            if chunk.section:
                location += f", section: {chunk.section}"
            blocks.append(f"[Excerpt {i} — {location}]\n{chunk.content}")
        return "\n\n---\n\n".join(blocks)

    async def stream_answer(
        self,
        question: str,
        chunks: list[RetrievedChunk],
        history: list[tuple[str, str]],
    ) -> AsyncGenerator[str, None]:
        system = SYSTEM_PROMPT.format(
            not_found=NOT_FOUND_ANSWER, context=self._format_context(chunks)
        )
        messages: list = [SystemMessage(content=system)]
        for role, content in history[-self.settings.history_window :]:
            messages.append(
                HumanMessage(content=content)
                if role == "user"
                else AIMessage(content=content)
            )
        messages.append(HumanMessage(content=question))

        async for chunk in self._llm.astream(messages):
            token = chunk.content
            if token:
                yield token

    async def generate_title(self, first_message: str) -> str:
        """Short chat title from the first user message (ChatGPT-style)."""
        try:
            response = await self._llm.ainvoke(
                [
                    HumanMessage(
                        content=(
                            "Write a very short title (max 5 words, no quotes, no "
                            "trailing punctuation) for a conversation that starts "
                            f"with this message:\n\n{first_message[:500]}"
                        )
                    )
                ]
            )
            title = (response.content or "").strip().strip('"')
            if title:
                return title[:60]
        except Exception:
            logger.exception("Title generation failed")
        return first_message[:47] + ("…" if len(first_message) > 47 else "")


_rag_service: RagService | None = None


def get_rag_service() -> RagService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RagService()
    return _rag_service
