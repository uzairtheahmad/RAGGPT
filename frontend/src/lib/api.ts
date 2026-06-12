import type {
  ChatDetail,
  ChatSummary,
  ChunkDetail,
  DocumentInfo,
  StreamCallbacks,
  UploadResult,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- Chats ----

export const listChats = () => request<ChatSummary[]>("/api/chats");

export const createChat = () =>
  request<ChatSummary>("/api/chats", { method: "POST", body: JSON.stringify({}) });

export const getChat = (chatId: string) => request<ChatDetail>(`/api/chats/${chatId}`);

export const renameChat = (chatId: string, title: string) =>
  request<ChatSummary>(`/api/chats/${chatId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });

export const deleteChat = (chatId: string) =>
  request<void>(`/api/chats/${chatId}`, { method: "DELETE" });

// ---- Documents ----

export const listDocuments = () => request<DocumentInfo[]>("/api/documents");

export const deleteDocument = (documentId: string) =>
  request<void>(`/api/documents/${documentId}`, { method: "DELETE" });

export const getChunk = (chunkId: string) =>
  request<ChunkDetail>(`/api/documents/chunks/${encodeURIComponent(chunkId)}`);

export async function uploadDocuments(files: File[]): Promise<UploadResult> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  const res = await fetch(`${API_BASE}/api/documents`, { method: "POST", body: form });
  if (!res.ok) {
    let detail = `Upload failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<UploadResult>;
}

// ---- Streaming chat (SSE over fetch) ----

export async function streamMessage(
  chatId: string,
  content: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ content }),
    signal,
  });
  if (!res.ok || !res.body) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* ignore */
    }
    callbacks.onError(detail);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleEvent = (eventName: string, data: string) => {
    if (!data) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    switch (eventName) {
      case "user_message":
        callbacks.onUserMessage?.(parsed as { id: string; created_at: string });
        break;
      case "title":
        callbacks.onTitle?.(parsed as { chat_id: string; title: string });
        break;
      case "token":
        callbacks.onToken(String(parsed.t ?? ""));
        break;
      case "sources":
        callbacks.onSources(
          (parsed.sources ?? []) as ChatDetail["messages"][number]["sources"]
        );
        break;
      case "done":
        callbacks.onDone(parsed as { message_id: string; created_at: string });
        break;
      case "error":
        callbacks.onError(String(parsed.message ?? "Unknown error"));
        break;
    }
  };

  const processBlock = (block: string) => {
    let eventName = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    handleEvent(eventName, dataLines.join("\n"));
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep).replace(/^\r?\n\r?\n/, "");
        processBlock(block);
      }
    }
    if (buffer.trim()) processBlock(buffer);
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError("Connection lost while streaming the response.");
    }
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
