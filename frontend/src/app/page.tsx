"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";

import * as api from "@/lib/api";
import type {
  ChatSummary,
  DocumentInfo,
  Message,
  SourceCitation,
} from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import DocumentsPanel from "@/components/DocumentsPanel";
import SourceModal from "@/components/SourceModal";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [inspectedChunk, setInspectedChunk] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showBanner = useCallback((text: string) => {
    setBanner(text);
    window.setTimeout(() => setBanner(null), 6000);
  }, []);

  const refreshChats = useCallback(async () => {
    try {
      setChats(await api.listChats());
    } catch {
      showBanner("Could not reach the backend. Is it running on port 8000?");
    }
  }, [showBanner]);

  const refreshDocuments = useCallback(async () => {
    try {
      setDocuments(await api.listDocuments());
    } catch {
      /* banner already handled by refreshChats */
    }
  }, []);

  useEffect(() => {
    void refreshChats();
    void refreshDocuments();
  }, [refreshChats, refreshDocuments]);

  const openChat = useCallback(
    async (chatId: string) => {
      abortRef.current?.abort();
      setActiveChatId(chatId);
      setSidebarOpen(false);
      try {
        const detail = await api.getChat(chatId);
        setMessages(detail.messages);
      } catch {
        showBanner("Failed to load this chat.");
      }
    },
    [showBanner]
  );

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setActiveChatId(null);
    setMessages([]);
    setSidebarOpen(false);
  }, []);

  const handleRename = useCallback(
    async (chatId: string, title: string) => {
      try {
        await api.renameChat(chatId, title);
        await refreshChats();
      } catch {
        showBanner("Rename failed.");
      }
    },
    [refreshChats, showBanner]
  );

  const handleDelete = useCallback(
    async (chatId: string) => {
      try {
        await api.deleteChat(chatId);
        if (chatId === activeChatId) {
          setActiveChatId(null);
          setMessages([]);
        }
        await refreshChats();
      } catch {
        showBanner("Delete failed.");
      }
    },
    [activeChatId, refreshChats, showBanner]
  );

  const handleUpload = useCallback(
    async (files: File[]) => {
      try {
        const result = await api.uploadDocuments(files);
        await refreshDocuments();
        if (result.failed.length > 0) {
          showBanner(
            result.failed.map((f) => `${f.filename}: ${f.error}`).join(" • ")
          );
        } else if (result.uploaded.length > 0) {
          showBanner(
            `Indexed ${result.uploaded.length} file${result.uploaded.length > 1 ? "s" : ""} ✓`
          );
        }
      } catch (err) {
        showBanner((err as Error).message || "Upload failed.");
      }
    },
    [refreshDocuments, showBanner]
  );

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      try {
        await api.deleteDocument(documentId);
        await refreshDocuments();
      } catch {
        showBanner("Failed to delete document.");
      }
    },
    [refreshDocuments, showBanner]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return;
      setIsStreaming(true);

      let chatId = activeChatId;
      try {
        if (!chatId) {
          const chat = await api.createChat();
          chatId = chat.chat_id;
          setActiveChatId(chatId);
          await refreshChats();
        }
      } catch {
        showBanner("Could not create a chat. Is the backend running?");
        setIsStreaming(false);
        return;
      }

      const now = new Date().toISOString();
      const userMsg: Message = {
        id: `local-user-${Date.now()}`,
        role: "user",
        content,
        sources: [],
        created_at: now,
      };
      const assistantMsg: Message = {
        id: `local-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        sources: [],
        created_at: now,
        streaming: true,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const controller = new AbortController();
      abortRef.current = controller;

      const updateAssistant = (update: Partial<Message>) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, ...update } : m))
        );
      };

      let acc = "";
      await api.streamMessage(
        chatId,
        content,
        {
          onTitle: ({ chat_id, title }) => {
            setChats((prev) =>
              prev.map((c) => (c.chat_id === chat_id ? { ...c, title } : c))
            );
          },
          onToken: (token) => {
            acc += token;
            updateAssistant({ content: acc });
          },
          onSources: (sources: SourceCitation[]) => {
            updateAssistant({ sources });
          },
          onDone: ({ message_id }) => {
            updateAssistant({ id: message_id, streaming: false });
            void refreshChats();
          },
          onError: (message) => {
            updateAssistant({
              content: acc || `⚠️ ${message}`,
              streaming: false,
            });
            if (acc) showBanner(message);
          },
        },
        controller.signal
      );

      updateAssistant({ streaming: false });
      setIsStreaming(false);
    },
    [activeChatId, isStreaming, refreshChats, showBanner]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages((prev) => prev.map((m) => ({ ...m, streaming: false })));
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        open={sidebarOpen}
        onNewChat={newChat}
        onOpenChat={openChat}
        onRename={handleRename}
        onDelete={handleDelete}
        onOpenDocuments={() => setDocsOpen(true)}
        documentCount={documents.filter((d) => d.status === "ready").length}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border-token px-4">
          <button
            className="rounded-lg p-2 hover:bg-surface-2 md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <h1 className="truncate text-sm font-medium">
            {chats.find((c) => c.chat_id === activeChatId)?.title ?? "New chat"}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        {banner && (
          <div className="fade-up mx-4 mt-3 rounded-xl border border-border-token bg-surface-2 px-4 py-2 text-sm">
            {banner}
          </div>
        )}

        <ChatMessages
          messages={messages}
          onInspectSource={(chunkId) => setInspectedChunk(chunkId)}
          hasDocuments={documents.some((d) => d.status === "ready")}
          onOpenDocuments={() => setDocsOpen(true)}
        />

        <ChatInput
          disabled={isStreaming}
          onSend={sendMessage}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          onUpload={handleUpload}
        />
      </div>

      {docsOpen && (
        <DocumentsPanel
          documents={documents}
          onClose={() => setDocsOpen(false)}
          onUpload={handleUpload}
          onDelete={handleDeleteDocument}
        />
      )}

      {inspectedChunk && (
        <SourceModal chunkId={inspectedChunk} onClose={() => setInspectedChunk(null)} />
      )}
    </div>
  );
}
