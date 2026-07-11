import { create } from "zustand";
import type { ColumnInfo } from "@/lib/columnStats";

export interface AnalysisJson {
  executive_summary: string;
  data_quality: {
    overall_score: number;
    issues: { column: string; issue: string; severity: "low" | "medium" | "high"; rows_affected: number }[];
  };
  key_metrics: {
    label: string;
    value: string;
    unit: string;
    trend: "up" | "down" | "flat" | "na";
    insight: string;
  }[];
  correlations: {
    col_a: string;
    col_b: string;
    strength: number;
    direction: "positive" | "negative";
    business_meaning: string;
  }[];
  anomalies: {
    column: string;
    description: string;
    severity: "low" | "medium" | "high";
    count: number;
    example_values: (string | number)[];
  }[];
  trends: { title: string; description: string; supporting_data: string }[];
  recommendations: {
    priority: number;
    category: "data_quality" | "business" | "investigation";
    action: string;
    expected_impact: string;
  }[];
  suggested_charts: {
    chart_type: "bar" | "line" | "scatter" | "histogram" | "heatmap";
    x_column: string;
    y_column: string;
    title: string;
    rationale: string;
  }[];
}

export interface ToolCallLog {
  id: string;
  tool_name: string;
  input: Record<string, unknown>;
  result: Record<string, unknown> | { error: string };
  duration_ms: number;
  called_at: string;
}

interface AnalysisStore {
  status: "idle" | "running" | "complete" | "failed";
  streamingText: string;
  analysis: AnalysisJson | null;
  toolCallLog: ToolCallLog[];
  error: string | null;
  corrections: number;

  reset: () => void;
  setStatus: (s: AnalysisStore["status"]) => void;
  appendStream: (chunk: string) => void;
  setAnalysis: (a: AnalysisJson) => void;
  addToolCall: (t: ToolCallLog) => void;
  setError: (e: string | null) => void;
  setCorrections: (n: number) => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  status: "idle",
  streamingText: "",
  analysis: null,
  toolCallLog: [],
  error: null,
  corrections: 0,

  reset: () =>
    set({ status: "idle", streamingText: "", analysis: null, toolCallLog: [], error: null, corrections: 0 }),
  setStatus: (status) => set({ status }),
  appendStream: (chunk) => set((s) => ({ streamingText: s.streamingText + chunk })),
  setAnalysis: (analysis) => set({ analysis }),
  addToolCall: (t) => set((s) => ({ toolCallLog: [...s.toolCallLog, t] })),
  setError: (error) => set({ error }),
  setCorrections: (corrections) => set({ corrections }),
}));

interface UploadStore {
  file: File | null;
  parsedRows: Record<string, unknown>[] | null;
  columns: ColumnInfo[] | null;
  uploadProgress: number;
  uploadedDatasetId: string | null;
  selectedColumn: string | null;
  setFile: (f: File | null) => void;
  setParsed: (rows: Record<string, unknown>[], cols: ColumnInfo[]) => void;
  setProgress: (p: number) => void;
  setDatasetId: (id: string | null) => void;
  selectColumn: (c: string | null) => void;
  reset: () => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
  file: null,
  parsedRows: null,
  columns: null,
  uploadProgress: 0,
  uploadedDatasetId: null,
  selectedColumn: null,
  setFile: (file) => set({ file }),
  setParsed: (parsedRows, columns) => set({ parsedRows, columns }),
  setProgress: (uploadProgress) => set({ uploadProgress }),
  setDatasetId: (uploadedDatasetId) => set({ uploadedDatasetId }),
  selectColumn: (selectedColumn) => set({ selectedColumn }),
  reset: () =>
    set({
      file: null,
      parsedRows: null,
      columns: null,
      uploadProgress: 0,
      uploadedDatasetId: null,
      selectedColumn: null,
    }),
}));

export interface MemoryItem {
  analysis_id: string;
  dataset_id: string;
  similarity: number;
  snippet: string;
  filename?: string;
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  toolCalls?: ToolCallLog[];
  memory?: MemoryItem[];
}

interface ChatStore {
  sessionId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  open: boolean;
  setSession: (id: string | null) => void;
  setOpen: (o: boolean) => void;
  addMessage: (m: ChatMessage) => void;
  appendToLast: (chunk: string) => void;
  setMemoryOnLast: (items: MemoryItem[]) => void;
  setStreaming: (b: boolean) => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  sessionId: null,
  messages: [],
  isStreaming: false,
  open: false,
  setSession: (sessionId) => set({ sessionId }),
  setOpen: (open) => set({ open }),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m].slice(-20) })),
  appendToLast: (chunk) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      messages[messages.length - 1] = { ...last, content: last.content + chunk };
      return { messages };
    }),
  setMemoryOnLast: (items) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      messages[messages.length - 1] = { ...last, memory: items };
      return { messages };
    }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  reset: () => set({ sessionId: null, messages: [], isStreaming: false, open: false }),
}));
