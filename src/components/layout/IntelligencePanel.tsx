import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, Wrench, Trash2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAdminChat } from "@/hooks/useAdminChat";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export function IntelligencePanel() {
  const { intelligencePanelOpen, setIntelligencePanelOpen } = useWorkspace();
  const { messages, isStreaming, sendMessage, clearChat, cancelStream } = useAdminChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!intelligencePanelOpen) return null;

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-card flex flex-col h-full animate-slide-in">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold tracking-wider uppercase">Admin Console</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearChat} title="Clear chat">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIntelligencePanelOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Chat messages */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Wrench className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Admin Console</p>
              <p className="text-xs text-muted-foreground mt-1">
                AI-powered system diagnostics & fixes.
              </p>
              <div className="mt-4 space-y-1.5 text-[10px] text-muted-foreground/60">
                <p>"What machines are idle and why?"</p>
                <p>"Any stuck orders? How to fix?"</p>
                <p>"Show me stock that's running low"</p>
                <p>"Diagnose production bottlenecks"</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "rounded-lg px-3 py-2 text-xs max-w-[95%]",
                msg.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-muted text-foreground"
              )}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs [&_p]:mb-1 [&_p]:mt-0 [&_pre]:text-[10px] [&_code]:text-[10px] [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
              <p className="text-[9px] opacity-50 mt-1">
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="mr-auto bg-muted rounded-lg px-3 py-2 text-xs flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-muted-foreground">Thinking...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex gap-1.5 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask or command..."
            className="min-h-[36px] max-h-[120px] text-xs resize-none"
            rows={1}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button size="sm" variant="destructive" className="h-9 w-9 p-0 shrink-0" onClick={cancelStream}>
              <Square className="w-3 h-3" />
            </Button>
          ) : (
            <Button size="sm" className="h-9 w-9 p-0 shrink-0" onClick={handleSend} disabled={!input.trim()}>
              <Send className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
