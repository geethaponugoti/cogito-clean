import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { Brain } from "lucide-react";
import { useChatStore, type MemoryItem } from "@/store";
import { ownerHeaders } from "@/integrations/supabase/owned";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const ChatPanel = ({ datasetId }: { datasetId: string }) => {
  const { messages, isStreaming, open, sessionId, setOpen, addMessage, appendToLast, setMemoryOnLast, setStreaming, setSession } = useChatStore();
  const [input, setInput] = useState("");

  const send = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    addMessage({ id: crypto.randomUUID(), role: "user", content: text });
    addMessage({ id: crypto.randomUUID(), role: "assistant", content: "", isStreaming: true });
    setStreaming(true);

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat-with-data`, {
        method: "POST",
        headers: ownerHeaders({ "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` }),
        body: JSON.stringify({
          dataset_id: datasetId,
          session_id: sessionId,
          message: text,
          history: messages.filter((m) => !m.isStreaming).slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!resp.ok || !resp.body) throw new Error("Chat failed");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let event = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).replace(/\r$/, "");
          buf = buf.slice(nl + 1);
          if (line.startsWith("event: ")) event = line.slice(7).trim();
          else if (line.startsWith("data: ")) {
            try {
              const d = JSON.parse(line.slice(6).trim());
              if (event === "session" && d.session_id) setSession(d.session_id);
              else if (event === "memory" && Array.isArray(d.items)) setMemoryOnLast(d.items as MemoryItem[]);
              else if (event === "text") appendToLast(d.chunk);
              else if (event === "error") toast({ title: "Chat error", description: d.message, variant: "destructive" });
            } catch {/* */}
          } else if (line === "") event = "";
        }
      }
    } catch (e) {
      toast({ title: "Chat failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-40 h-12 w-12 bg-primary text-primary-foreground shadow-glow rounded-sm hover:shadow-elevated flex items-center justify-center"
        aria-label="Toggle chat"
      >
        💬
      </button>
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: 380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 380, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
            className="fixed top-14 right-0 bottom-0 w-[380px] z-30 bg-surface border-l border-border flex flex-col"
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Ask the agent</div>
                <div className="text-sm font-display">About this dataset</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">×</button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-xs text-muted-foreground space-y-2">
                  <div className="font-mono">Try asking:</div>
                  <button onClick={() => setInput("Which column has the strongest signal?")}
                    className="block w-full text-left p-2 border border-border hover:bg-accent rounded-sm">
                    Which column has the strongest signal?
                  </button>
                  <button onClick={() => setInput("Are there any obvious outliers I should worry about?")}
                    className="block w-full text-left p-2 border border-border hover:bg-accent rounded-sm">
                    Any outliers I should worry about?
                  </button>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
                  <div className={`inline-block max-w-[90%] text-sm px-3 py-2 rounded-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  }`}>
                    {m.role === "assistant"
                      ? <div className="prose prose-sm prose-invert max-w-none [&>*]:my-1">
                          <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                        </div>
                      : m.content}
                  </div>
                  {m.role === "assistant" && m.memory && m.memory.length > 0 && (
                    <div className="mt-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="inline-flex">
                            <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                              <Brain className="h-3 w-3" />
                              Memory used · {m.memory.length}
                            </Badge>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-80 p-3">
                          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
                            Retrieved past analyses
                          </div>
                          <div className="space-y-2">
                            {m.memory.map((mi) => (
                              <div key={mi.analysis_id} className="border border-border rounded-sm p-2 text-xs">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-medium truncate">{mi.filename ?? "Unknown dataset"}</span>
                                  <span className="font-mono text-muted-foreground shrink-0">
                                    {(mi.similarity * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <p className="text-muted-foreground line-clamp-3">{mi.snippet}</p>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-border p-3 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask anything…"
                className="flex-1 bg-background border border-border px-3 py-2 text-sm rounded-sm focus:outline-none focus:border-primary"
              />
              <button onClick={send} disabled={isStreaming}
                className="px-3 py-2 bg-primary text-primary-foreground text-sm rounded-sm disabled:opacity-50">
                {isStreaming ? "…" : "Send"}
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};
