"use client";

import { useMemo, useState } from "react";
import {
  Check,
  FileText,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";

import type { ChatSummary } from "@/lib/types";

interface SidebarProps {
  chats: ChatSummary[];
  activeChatId: string | null;
  open: boolean;
  documentCount: number;
  onNewChat: () => void;
  onOpenChat: (chatId: string) => void;
  onRename: (chatId: string, title: string) => void;
  onDelete: (chatId: string) => void;
  onOpenDocuments: () => void;
}

export default function Sidebar({
  chats,
  activeChatId,
  open,
  documentCount,
  onNewChat,
  onOpenChat,
  onRename,
  onDelete,
  onOpenDocuments,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [chats, query]);

  const startEdit = (chat: ChatSummary) => {
    setEditingId(chat.chat_id);
    setEditTitle(chat.title);
  };

  const commitEdit = () => {
    if (editingId && editTitle.trim()) onRename(editingId, editTitle.trim());
    setEditingId(null);
  };

  return (
    <aside
      className={clsx(
        "z-40 flex h-full w-72 shrink-0 flex-col bg-sidebar",
        "fixed inset-y-0 left-0 transition-transform duration-200 ease-out md:static md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2 px-1 pb-1 pt-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <FileText size={15} />
          </div>
          <span className="text-sm font-semibold tracking-tight">RAGGPT</span>
        </div>

        <button
          onClick={onNewChat}
          className="flex items-center gap-2 rounded-xl border border-border-token bg-surface px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-hover"
        >
          <Plus size={16} />
          New chat
        </button>

        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="w-full rounded-xl bg-sidebar-hover py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:ring-1 focus:ring-border-token"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {filtered.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted">
            {chats.length === 0 ? "No chats yet. Start one!" : "No matching chats."}
          </p>
        )}
        <ul className="flex flex-col gap-0.5">
          {filtered.map((chat) => (
            <li key={chat.chat_id} className="group relative">
              {editingId === chat.chat_id ? (
                <div className="flex items-center gap-1 rounded-xl bg-sidebar-active px-2 py-1.5">
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                  <button
                    onClick={commitEdit}
                    className="rounded p-1 hover:bg-sidebar-hover"
                    aria-label="Save title"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded p-1 hover:bg-sidebar-hover"
                    aria-label="Cancel rename"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : confirmDeleteId === chat.chat_id ? (
                <div className="flex items-center gap-1 rounded-xl bg-sidebar-active px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs text-danger">
                    Delete this chat?
                  </span>
                  <button
                    onClick={() => {
                      onDelete(chat.chat_id);
                      setConfirmDeleteId(null);
                    }}
                    className="rounded p-1 text-danger hover:bg-sidebar-hover"
                    aria-label="Confirm delete"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded p-1 hover:bg-sidebar-hover"
                    aria-label="Cancel delete"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onOpenChat(chat.chat_id)}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                    chat.chat_id === activeChatId
                      ? "bg-sidebar-active"
                      : "hover:bg-sidebar-hover"
                  )}
                >
                  <MessageSquare size={14} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                  <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(chat);
                      }}
                      className="rounded p-1 hover:bg-sidebar-active"
                      aria-label="Rename chat"
                    >
                      <Pencil size={13} />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(chat.chat_id);
                      }}
                      className="rounded p-1 text-danger hover:bg-sidebar-active"
                      aria-label="Delete chat"
                    >
                      <Trash2 size={13} />
                    </span>
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-border-token p-3">
        <button
          onClick={onOpenDocuments}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-hover"
        >
          <FileText size={15} className="text-muted" />
          <span className="flex-1 text-left">Knowledge base</span>
          <span className="rounded-full bg-sidebar-active px-2 py-0.5 text-xs text-muted">
            {documentCount}
          </span>
        </button>
      </div>
    </aside>
  );
}
