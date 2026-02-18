import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichMarkdown } from "@/components/chat/RichMarkdown";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-chat`;
const BTN_SIZE = 56;

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export const PublicChatWidget = React.forwardRef<HTMLDivElement, {}>(
  function PublicChatWidget(_props, _ref) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { pos, handlers, wasDragged } = useDraggablePosition({
    storageKey: "chat-widget-pos",
    btnSize: BTN_SIZE,
    defaultPos: () => ({
      x: typeof window !== "undefined" ? window.innerWidth - BTN_SIZE - 16 : 300,
      y: typeof window !== "undefined" ? window.innerHeight - BTN_SIZE - 16 : 300,
    }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 100) + "px";
    }
  }, [input]);

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

  const handleBubblePointerUp = useCallback((e: React.PointerEvent) => {
    handlers.onPointerUp(e);
    if (!wasDragged.current) {
      setOpen((prev) => !prev);
    }
  }, [handlers, wasDragged]);

  // Position chat panel above the bubble
  const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.min(pos.x - 350 + BTN_SIZE, window.innerWidth - 360),
    top: Math.max(pos.y - 530, 8),
    zIndex: 50,
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div style={panelStyle} className="w-[350px] sm:w-[400px] max-h-[520px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200 border border-border/50 bg-card">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Support</p>
                <p className="text-[10px] opacity-80">Typically replies instantly</p>
              </div>
            </div>
            <button onClick={handleClose} className="w-7 h-7 rounded-full hover:bg-primary-foreground/20 transition-colors flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 max-h-[360px] overflow-hidden">
            <div className="p-4 space-y-3 overflow-hidden">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <MessageCircle className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">Welcome to Rebar Shop</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[260px] mx-auto">
                    Ask about pricing, products, estimating, or anything rebar related.
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                    {["Product pricing", "Custom bending", "Get a quote"].map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setInput(q);
                          setTimeout(() => {
                            setInput(q);
                            sendMessage();
                          }, 50);
                        }}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[85%] min-w-0",
                    msg.role === "user" ? "ml-auto" : "mr-auto"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed break-words min-w-0 [overflow-wrap:anywhere]",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <RichMarkdown content={msg.content} className="text-[13px] [&_p]:text-[13px] [&_pre]:overflow-x-auto [&_code]:break-all [&_p]:break-words [&_*]:max-w-full" />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="mr-auto max-w-[85%]">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[13px] flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Typing...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-border p-3 bg-card">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 min-h-[40px] max-h-[100px] min-w-0 text-sm resize-none bg-muted rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                rows={1}
                disabled={isStreaming}
              />
              <Button
                size="sm"
                className="h-10 w-10 p-0 shrink-0 rounded-xl"
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
              >
                {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating bubble — draggable */}
      <button
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handleBubblePointerUp}
        className={cn(
          "fixed z-50 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center cursor-grab active:cursor-grabbing select-none",
          open
            ? "bg-muted text-muted-foreground hover:bg-muted/80"
            : "bg-primary text-primary-foreground hover:scale-105"
        )}
        style={{ left: pos.x, top: pos.y, touchAction: "none" }}
        aria-label="Open chat"
      >
        {open ? <X className="w-5 h-5 pointer-events-none" /> : <MessageCircle className="w-6 h-6 pointer-events-none" />}
      </button>
    </>
  );
});
PublicChatWidget.displayName = "PublicChatWidget";
