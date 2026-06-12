"use client";

import { useRef, useState } from "react";
import { ArrowUp, Paperclip, Square } from "lucide-react";

interface ChatInputProps {
  disabled: boolean;
  isStreaming: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
  onUpload: (files: File[]) => Promise<void>;
}

export default function ChatInput({
  disabled,
  isStreaming,
  onSend,
  onStop,
  onUpload,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const content = value.trim();
    if (!content || disabled) return;
    onSend(content);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      await onUpload(Array.from(fileList));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="shrink-0 px-4 pb-4 pt-2">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-3xl border border-border-token bg-surface px-3 py-2 shadow-sm focus-within:ring-1 focus-within:ring-border-token">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
            accept=".pdf,.txt,.md,.markdown,.mdx,.csv,.tsv,.xlsx,.xls,.xlsm,.docx,.pptx,.json,.jsonl,.ndjson,.xml,.html,.htm,.log,.py,.js,.jsx,.ts,.tsx,.java,.cpp,.cc,.cxx,.c,.h,.hpp,.go,.rs,.php,.sql,.rb,.swift,.kt,.cs,.sh,.ps1,.r,.scala,.lua,.yaml,.yml,.toml,.ini,.cfg"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
            aria-label="Upload documents"
            title="Upload documents"
          >
            {uploading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-transparent" />
            ) : (
              <Paperclip size={18} />
            )}
          </button>

          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            onChange={(e) => {
              setValue(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask about your documents…"
            className="max-h-50 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[15px] outline-none placeholder:text-muted"
          />

          {isStreaming ? (
            <button
              onClick={onStop}
              className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity hover:opacity-85"
              aria-label="Stop generating"
              title="Stop generating"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!value.trim() || disabled}
              className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-30"
              aria-label="Send message"
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted">
          Answers are grounded only in your uploaded documents.
        </p>
      </div>
    </div>
  );
}
