export interface SourceCitation {
  source_file: string;
  page: number | string | null;
  section: string | null;
  chunk_id: string;
  snippet: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: SourceCitation[];
  created_at: string;
  streaming?: boolean;
}

export interface ChatSummary {
  chat_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatDetail extends ChatSummary {
  messages: Message[];
}

export interface DocumentInfo {
  id: string;
  filename: string;
  file_type: string;
  size_bytes: number;
  chunk_count: number;
  status: string;
  error: string | null;
  created_at: string;
}

export interface UploadResult {
  uploaded: DocumentInfo[];
  failed: { filename: string; error: string }[];
}

export interface ChunkDetail {
  chunk_id: string;
  content: string;
  source_file: string;
  page: number | string | null;
  section: string | null;
}

export interface StreamCallbacks {
  onUserMessage?: (data: { id: string; created_at: string }) => void;
  onTitle?: (data: { chat_id: string; title: string }) => void;
  onToken: (token: string) => void;
  onSources: (sources: SourceCitation[]) => void;
  onDone: (data: { message_id: string; created_at: string }) => void;
  onError: (message: string) => void;
}
