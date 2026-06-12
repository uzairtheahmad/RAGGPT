"use client";

import { useRef, useState } from "react";
import { FileText, Trash2, Upload, X } from "lucide-react";
import clsx from "clsx";

import { formatBytes } from "@/lib/api";
import type { DocumentInfo } from "@/lib/types";

interface DocumentsPanelProps {
  documents: DocumentInfo[];
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (documentId: string) => void;
}

export default function DocumentsPanel({
  documents,
  onClose,
  onUpload,
  onDelete,
}: DocumentsPanelProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      await onUpload(files);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="fade-up flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-border-token bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-token px-5 py-4">
          <h2 className="text-base font-semibold">Knowledge base</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void handleFiles(Array.from(e.dataTransfer.files));
            }}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
              dragging
                ? "border-accent bg-surface-2"
                : "border-border-token hover:bg-surface-2"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) =>
                void handleFiles(Array.from(e.target.files ?? []))
              }
            />
            {uploading ? (
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-transparent" />
            ) : (
              <Upload size={22} className="text-muted" />
            )}
            <p className="text-sm font-medium">
              {uploading ? "Indexing…" : "Drop files here or click to upload"}
            </p>
            <p className="text-xs text-muted">
              PDF, Word, Excel, PowerPoint, CSV, Markdown, JSON, HTML, code files… (max 25 MB)
            </p>
          </div>

          <ul className="mt-4 flex flex-col gap-1.5">
            {documents.length === 0 && (
              <p className="py-4 text-center text-sm text-muted">
                No documents uploaded yet.
              </p>
            )}
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-3 rounded-xl border border-border-token px-3 py-2.5"
              >
                <FileText size={16} className="shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.filename}</p>
                  <p className="text-xs text-muted">
                    {doc.file_type.toUpperCase()} · {formatBytes(doc.size_bytes)} ·{" "}
                    {doc.chunk_count} chunks
                  </p>
                </div>
                <button
                  onClick={() => onDelete(doc.id)}
                  className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-danger"
                  aria-label={`Delete ${doc.filename}`}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
