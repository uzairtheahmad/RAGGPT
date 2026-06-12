"use client";

import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";

import { getChunk } from "@/lib/api";
import type { ChunkDetail } from "@/lib/types";

interface SourceModalProps {
  chunkId: string;
  onClose: () => void;
}

export default function SourceModal({ chunkId, onClose }: SourceModalProps) {
  const [chunk, setChunk] = useState<ChunkDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getChunk(chunkId)
      .then(setChunk)
      .catch(() => setError("Could not load this source excerpt."));
  }, [chunkId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="fade-up flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-border-token bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border-token px-5 py-4">
          <FileText size={16} className="shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">
              {chunk?.source_file ?? "Source"}
            </h2>
            {chunk && (
              <p className="text-xs text-muted">
                {chunk.page != null && chunk.page !== "" && (
                  <span>
                    {typeof chunk.page === "number"
                      ? `Page ${chunk.page}`
                      : String(chunk.page)}
                  </span>
                )}
                {chunk.section && (
                  <span>
                    {chunk.page != null && chunk.page !== "" ? " · " : ""}
                    {chunk.section}
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && <p className="text-sm text-danger">{error}</p>}
          {!chunk && !error && (
            <p className="text-sm text-muted">Loading excerpt…</p>
          )}
          {chunk && (
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-surface-2 p-4 font-sans text-sm leading-relaxed">
              {chunk.content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
