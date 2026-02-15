import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-chat`;

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function PublicChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleClose = () => {
    abortRef.current?.abort();
    setOpen(false);
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    const assistantId = crypto.randomUUID();

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, currentPage: "/", publicMode: true }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "Sorry, I'm unable to respond right now. Please try again." }]);
        setIsStreaming(false);
        return;
      }

      let content = "";
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const chunk = parsed.choices?.[0]?.delta?.content;
            if (chunk) {
              content += chunk;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.id === assistantId) {
                  return prev.map((m) => (m.id === assistantId ? { ...m, content } : m));
                }
                return [...prev, { id: assistantId, role: "assistant", content }];
              });
            }
          } catch { break; }
        }
      }

      if (!content) {
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "Hi! Ask me anything about rebar fabrication, estimating, or our platform." }]);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "Connection error. Please try again." }]);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, messages, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[340px] sm:w-[380px] max-h-[500px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Ask Vizzy</span>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 max-h-[340px]">
            <div className="p-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium">Welcome to Rebar Shop OS</p>
                  <p className="text-xs text-muted-foreground mt-1">Ask about estimating, production, pricing, or anything rebar.</p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs max-w-[90%] whitespace-pre-wrap",
                    msg.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto bg-muted text-foreground"
                  )}
                >
                  {msg.content}
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="mr-auto bg-muted rounded-xl px-3 py-2 text-xs flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-muted-foreground">Thinking...</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-border p-3">
            <div className="flex gap-1.5 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a question..."
                className="flex-1 min-h-[36px] max-h-[80px] text-xs resize-none bg-secondary rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30"
                rows={1}
                disabled={isStreaming}
              />
              <Button size="sm" className="h-9 w-9 p-0 shrink-0 rounded-lg" onClick={sendMessage} disabled={!input.trim() || isStreaming}>
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating bubble */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
        aria-label="Open chat"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </>
  );
}
