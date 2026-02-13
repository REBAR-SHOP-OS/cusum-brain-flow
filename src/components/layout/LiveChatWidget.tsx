// forwardRef cache bust
import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminChat } from "@/hooks/useAdminChat";
import { RichMarkdown } from "@/components/chat/RichMarkdown";
import { ScrollArea } from "@/components/ui/scroll-area";

export const LiveChatWidget = React.forwardRef<HTMLDivElement, {}>(function LiveChatWidget(_props, ref) {
  const [open, setOpen] = useState(false);

  // Listen for external toggle requests
  useEffect(() => {
    const handler = () => setOpen((prev) => !prev);
    window.addEventListener("toggle-live-chat", handler);
    return () => window.removeEventListener("toggle-live-chat", handler);
  }, []);
  const [input, setInput] = useState("");
  const { messages, isStreaming, sendMessage, clearChat, cancelStream } = useAdminChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Cancel stream when closing the panel
  const handleClose = () => {
    if (isStreaming) cancelStream();
    setOpen(false);
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 md:bottom-20 md:right-6 w-[340px] sm:w-[380px] max-h-[500px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col animate-scale-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Live Chat</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearChat} title="Clear">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 max-h-[340px]">
            <div className="p-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium">How can we help?</p>
                  <p className="text-xs text-muted-foreground mt-1">Ask anything about your business</p>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs max-w-[90%]",
                    msg.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto bg-muted text-foreground"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <RichMarkdown content={msg.content} className="text-xs [&_p]:text-xs" />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
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

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex gap-1.5 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 min-h-[36px] max-h-[80px] text-xs resize-none bg-secondary rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30"
                rows={1}
                disabled={isStreaming}
              />
              {isStreaming ? (
                <Button size="sm" variant="destructive" className="h-9 w-9 p-0 shrink-0 rounded-lg" onClick={cancelStream}>
                  <Square className="w-3 h-3" />
                </Button>
              ) : (
                <Button size="sm" className="h-9 w-9 p-0 shrink-0 rounded-lg" onClick={handleSend} disabled={!input.trim()}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
});
LiveChatWidget.displayName = "LiveChatWidget";
