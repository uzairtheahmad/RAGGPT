"use client";

import { useEffect, useRef } from "react";
import { FileText, Sparkles, Upload } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Message, SourceCitation } from "@/lib/types";

interface ChatMessagesProps {
  messages: Message[];
  hasDocuments: boolean;
  onInspectSource: (chunkId: string) => void;
  onOpenDocuments: () => void;
}

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 py-2">
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
    </span>
  );
}

function Sources({
  sources,
  onInspect,
}: {
  sources: SourceCitation[];
  onInspect: (chunkId: string) => void;
}) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-3 border-t border-border-token pt-3">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        Sources
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <button
            key={source.chunk_id}
            onClick={() => onInspect(source.chunk_id)}
            title={source.snippet}
            className="flex items-center gap-1.5 rounded-lg border border-border-token bg-surface-2 px-2.5 py-1 text-xs transition-colors hover:bg-sidebar-hover"
          >
            <FileText size={12} className="shrink-0 text-muted" />
            <span className="max-w-48 truncate">
              {source.source_file}
              {source.page != null && source.page !== "" && (
                <span className="text-muted">
                  {typeof source.page === "number" ? ` · p.${source.page}` : ` · ${source.page}`}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  hasDocuments,
  onOpenDocuments,
}: {
  hasDocuments: boolean;
  onOpenDocuments: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Sparkles size={22} />
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Chat with your documents
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          {hasDocuments
            ? "Ask anything about your uploaded documents. Answers are grounded strictly in their content, with citations."
            : "Upload PDFs, Word, Excel, PowerPoint, Markdown, code files and more — then ask questions answered only from their content."}
        </p>
      </div>
      {!hasDocuments && (
        <button
          onClick={onOpenDocuments}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85"
        >
          <Upload size={15} />
          Upload documents
        </button>
      )}
    </div>
  );
}

export default function ChatMessages({
  messages,
  hasDocuments,
  onInspectSource,
  onOpenDocuments,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <main className="flex-1 overflow-y-auto">
        <EmptyState hasDocuments={hasDocuments} onOpenDocuments={onOpenDocuments} />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="fade-up flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-bubble-user px-4 py-2.5 text-[15px] leading-relaxed">
                {message.content}
              </div>
            </div>
          ) : (
            <div key={message.id} className="fade-up flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-token bg-surface">
                <Sparkles size={13} />
              </div>
              <div className="min-w-0 flex-1 text-[15px]">
                {message.content ? (
                  <div className="prose-chat">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                    {message.streaming && <span className="stream-caret" />}
                  </div>
                ) : message.streaming ? (
                  <TypingIndicator />
                ) : null}
                {!message.streaming && (
                  <Sources sources={message.sources} onInspect={onInspectSource} />
                )}
              </div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>
    </main>
  );
}
