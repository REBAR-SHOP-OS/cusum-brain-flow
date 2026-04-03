import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Trash2, SpellCheck, Sparkles, ShieldCheck, Clock3, Grip, ArrowUpRight } from "lucide-react";
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
  "Get a quote for my project",
  "Explain custom bending options",
  "Compare product pricing",
] as const;

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
            content: "G'day! Welcome to Rebar Shop. I can help with quotes, product guidance, custom bending, and project planning."
          }]);
        }
      }
    }, [open, messages.length]);

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 112) + "px";
      }
    }, [input]);

    const handleClose = () => {
      abortRef.current?.abort();
      setOpen(false);
    };

    const sendMessage = useCallback(async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || isStreaming) return;

      const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
      const nextHistory = [...messages, userMsg];
      setMessages(nextHistory);
      setInput("");
      setIsStreaming(true);

      const history = nextHistory.map((m) => ({ role: m.role, content: m.content }));
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

    const panelWidth = typeof window !== "undefined"
      ? (window.innerWidth < 640 ? Math.min(window.innerWidth - 24, 360) : 420)
      : 420;

    const panelStyle: React.CSSProperties = {
      position: "fixed",
      left: typeof window !== "undefined"
        ? Math.max(12, Math.min(pos.x - panelWidth + BTN_SIZE, window.innerWidth - panelWidth - 12))
        : pos.x,
      top: typeof window !== "undefined"
        ? Math.max(12, Math.min(pos.y - 640, window.innerHeight - 140))
        : pos.y,
      zIndex: 50,
      width: panelWidth,
    };

    const showStarterPrompts = messages.length <= 1;

    return (
      <>
        {open && (
          <div
            style={panelStyle}
            className="max-h-[640px] overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,20,28,0.98),rgba(15,23,42,0.98))] text-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.85)] animate-in slide-in-from-bottom-4 fade-in duration-200"
          >
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.45),transparent_55%)] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                    <MessageCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                      <Sparkles className="h-3 w-3" />
                      AI support
                    </div>
                    <p className="mt-2 text-base font-semibold leading-tight text-white">Website chat concierge</p>
                    <p className="text-xs text-white/65">Fast answers for quotes, stock, and project questions.</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-colors hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { icon: Clock3, label: "Response", value: "Instant" },
                  { icon: ShieldCheck, label: "Channel", value: "Secure" },
                  { icon: Grip, label: "Mode", value: "Drag + dock" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-[11px] text-white/60">
                      <item.icon className="h-3.5 w-3.5 text-primary" />
                      {item.label}
                    </div>
                    <div className="mt-1 text-sm font-medium text-white">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <ScrollArea className="h-[410px] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_24%)]">
              <div className="space-y-4 px-4 py-4">
                {showStarterPrompts && (
                  <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-medium text-white">How can we help?</p>
                    <p className="mt-1 text-xs leading-5 text-white/60">
                      Ask about pricing, fabrication options, delivery timing, or submit a project request.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {STARTER_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => sendMessage(prompt)}
                          disabled={isStreaming}
                          className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "group/msg relative max-w-[88%] min-w-0",
                      msg.role === "user" ? "ml-auto" : "mr-auto"
                    )}
                  >
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-sm transition-opacity group-hover/msg:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <div
                      className={cn(
                        "rounded-[26px] border px-4 py-3 text-[13px] leading-7 [overflow-wrap:anywhere]",
                        msg.role === "user"
                          ? "border-primary/20 bg-primary text-primary-foreground shadow-[0_18px_35px_-24px_hsl(var(--primary))]"
                          : "border-white/10 bg-white/5 text-white"
                      )}
                    >
                      <div className="mb-2 flex items-center gap-2 text-[11px] font-medium">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5",
                          msg.role === "user" ? "bg-primary-foreground/10 text-primary-foreground/80" : "bg-white/10 text-white/65"
                        )}>
                          {msg.role === "user" ? "You" : "Rebar Shop"}
                        </span>
                      </div>
                      {msg.role === "assistant" ? (
                        <RichMarkdown content={msg.content} className="text-[13px] text-white [&_p]:text-[13px] [&_pre]:overflow-x-auto [&_code]:break-all [&_p]:break-words [&_*]:max-w-full" />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}

                {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="mr-auto max-w-[88%]">
                    <div className="flex items-center gap-2 rounded-[26px] border border-white/10 bg-white/5 px-4 py-3 text-[13px] text-white/65">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-white/10 bg-black/10 px-4 py-4">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    className="min-h-[52px] max-h-[112px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/40"
                    rows={1}
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
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {grammar.checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <SpellCheck className="h-4 w-4" />}
                  </button>
                  <Button
                    size="sm"
                    className="h-11 w-11 shrink-0 rounded-2xl bg-primary p-0 text-primary-foreground hover:bg-primary/90"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isStreaming}
                  >
                    {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-white/45">
                  <span>Enter to send. Shift + Enter for a new line.</span>
                  <a
                    href="https://rebar.shop"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary/80"
                  >
                    Learn more
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onPointerDown={handlers.onPointerDown}
          onPointerMove={handlers.onPointerMove}
          onPointerUp={handleBubblePointerUp}
          className={cn(
            "fixed z-50 flex h-14 w-14 select-none items-center justify-center rounded-full border shadow-[0_22px_45px_-20px_rgba(15,23,42,0.8)] transition-all cursor-grab active:cursor-grabbing",
            open
              ? "border-white/10 bg-slate-800 text-white hover:bg-slate-700"
              : "border-primary/20 bg-primary text-primary-foreground hover:scale-[1.03]"
          )}
          style={{ left: pos.x, top: pos.y, touchAction: "none" }}
          aria-label="Open chat"
        >
          <span className={cn(
            "absolute inset-0 rounded-full",
            !open && "animate-ping bg-primary/20"
          )} />
          <span className="relative">
            {open ? <X className="h-5 w-5 pointer-events-none" /> : <MessageCircle className="h-6 w-6 pointer-events-none" />}
          </span>
        </button>
      </>
    );
  });
PublicChatWidget.displayName = "PublicChatWidget";
