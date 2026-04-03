import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  ChevronRight,
  Loader2,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  SpellCheck,
  Trash2,
  X,
} from "lucide-react";
import { useGrammarCheck } from "@/hooks/useGrammarCheck";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichMarkdown } from "@/components/chat/RichMarkdown";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/website-chat`;
const BTN_SIZE = 56;

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const STARTER_PROMPTS = [
  "I need a quote for a project",
  "Show me product pricing",
  "Can you help with custom bending?",
];

const WELCOME_MESSAGE =
  "Welcome to REBAR SHOP support. I can help with quotes, product guidance, fabrication workflows, and next steps for your project.";

export const PublicChatWidget = React.forwardRef<HTMLDivElement, {}>(
  function PublicChatWidget(_props, _ref) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const grammar = useGrammarCheck();
  const deleteMessage = useCallback((id: string) => setMessages((prev) => prev.filter((m) => m.id !== id)), []);
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
    if (open) {
      inputRef.current?.focus();
      if (messages.length === 0) {
        setMessages([{
          id: crypto.randomUUID(),
          role: "assistant",
          content: WELCOME_MESSAGE,
        }]);
      }
    }
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

  const sendPrompt = useCallback(async (prompt: string) => {
    setInput(prompt);
    await Promise.resolve();
    const text = prompt.trim();
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
        body: JSON.stringify({ messages: history }),
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
          } catch {
            break;
          }
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
  }, [isStreaming, messages]);

  const sendMessage = useCallback(async () => {
    await sendPrompt(input);
  }, [input, sendPrompt]);

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
  const panelWidth = typeof window !== "undefined" && window.innerWidth < 640 ? Math.min(window.innerWidth - 24, 380) : 400;
  const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: typeof window !== "undefined"
      ? Math.max(12, Math.min(pos.x - panelWidth + BTN_SIZE, window.innerWidth - panelWidth - 12))
      : 12,
    top: typeof window !== "undefined"
      ? Math.max(12, Math.min(pos.y - 620, window.innerHeight - 140))
      : 12,
    zIndex: 50,
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          style={{ ...panelStyle, width: panelWidth }}
          className="flex max-h-[640px] flex-col overflow-hidden rounded-[30px] border border-border/60 bg-card shadow-[0_28px_80px_rgba(15,23,42,0.28)] animate-in slide-in-from-bottom-4 fade-in duration-200"
        >
          {/* Header */}
          <div className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(135deg,hsl(var(--primary))_0%,rgba(14,165,233,0.92)_100%)] px-5 py-4 text-primary-foreground">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_30%)]" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/16 backdrop-blur">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold leading-tight">AI chat concierge</p>
                    <span className="rounded-full bg-white/14 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                      Live
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-primary-foreground/82">
                    Modern website support for quotes, products, and project guidance.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-primary-foreground/85">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1">
                      <Sparkles className="h-3 w-3" />
                      AI-assisted
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1">
                      <ShieldCheck className="h-3 w-3" />
                      Fast replies
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.07),transparent_22%),transparent]">
            <div className="space-y-4 p-4">
              {messages.length === 0 && (
                <div className="rounded-[28px] border border-border/60 bg-background/85 p-5 text-center shadow-sm">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[22px] bg-primary/10 text-primary">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Ask anything about your next rebar order</p>
                  <p className="mx-auto mt-1 max-w-[280px] text-xs leading-5 text-muted-foreground">
                    Get product help, request a quote, or start a conversation about fabrication requirements.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {STARTER_PROMPTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendPrompt(q)}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        {q}
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "group/msg relative max-w-[85%] min-w-0",
                    msg.role === "user" ? "ml-auto" : "mr-auto"
                  )}
                >
                  <button
                    onClick={() => deleteMessage(msg.id)}
                    className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-sm transition-opacity group-hover/msg:opacity-100"
                    title="Delete"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                  <div
                    className={cn(
                      "min-w-0 break-words rounded-[24px] border px-4 py-3 text-[13px] leading-relaxed [overflow-wrap:anywhere]",
                      msg.role === "user"
                        ? "rounded-br-md border-primary/20 bg-primary text-primary-foreground shadow-sm"
                        : "rounded-bl-md border-border/60 bg-background/90 text-foreground shadow-sm"
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
                  <div className="flex items-center gap-2 rounded-[24px] rounded-bl-md border border-border/60 bg-background/90 px-4 py-3 text-[13px] shadow-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Typing...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-border/60 bg-card p-4">
            <div className="rounded-[26px] border border-border/60 bg-background/90 p-3 shadow-sm">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tell us what you need help with..."
                  className="min-h-[54px] max-h-[120px] min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
                  rows={2}
                  disabled={isStreaming}
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!input.trim()) return;
                    const result = await grammar.check(input);
                    if (result.changed) setInput(result.corrected);
                  }}
                  disabled={grammar.checking || !input.trim() || isStreaming}
                  title="Check spelling"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {grammar.checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <SpellCheck className="h-4 w-4" />}
                </button>
                <Button
                  size="sm"
                  className="h-11 shrink-0 rounded-2xl px-4"
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                >
                  {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send
                </Button>
              </div>
              <div className="mt-2 flex flex-col gap-2 px-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>Ask about pricing, delivery, product options, or custom fabrication.</span>
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  AI-guided website support
                </span>
              </div>
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
          "fixed z-50 flex h-16 w-16 items-center justify-center rounded-full shadow-[0_18px_50px_rgba(14,165,233,0.38)] transition-all cursor-grab select-none active:cursor-grabbing",
          open
            ? "bg-muted text-muted-foreground hover:bg-muted/80"
            : "bg-[linear-gradient(135deg,hsl(var(--primary))_0%,rgba(14,165,233,0.92)_100%)] text-primary-foreground hover:scale-105"
        )}
        style={{ left: pos.x, top: pos.y, touchAction: "none" }}
        aria-label="Open chat"
      >
        <span className="pointer-events-none absolute inset-1 rounded-full border border-white/15" />
        {open ? <X className="pointer-events-none h-5 w-5" /> : <MessageCircle className="pointer-events-none h-6 w-6" />}
      </button>
    </>
  );
});
PublicChatWidget.displayName = "PublicChatWidget";
