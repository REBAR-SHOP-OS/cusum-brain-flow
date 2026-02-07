import { useState, useRef, useEffect, useCallback } from "react";
import { X, Sparkles, Send, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useCommandHandler } from "@/hooks/useCommandHandler";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface ChatEntry {
  id: string;
  role: "user" | "system";
  content: string;
  timestamp: Date;
}

export function IntelligencePanel() {
  const { intelligencePanelOpen, setIntelligencePanelOpen } = useWorkspace();
  const { executeCommand, isProcessing } = useCommandHandler();
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [question, setQuestion] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!question.trim() || isProcessing) return;
    const q = question.trim();
    setQuestion("");

    const userMsg: ChatEntry = {
      id: crypto.randomUUID(),
      role: "user",
      content: q,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const result = await executeCommand(q);

    const sysMsg: ChatEntry = {
      id: crypto.randomUUID(),
      role: "system",
      content: result?.message || "No response.",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, sysMsg]);
  }, [question, isProcessing, executeCommand]);

  if (!intelligencePanelOpen) return null;

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-card flex flex-col h-full animate-slide-in">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold tracking-wider uppercase">Admin Console</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIntelligencePanelOpen(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Chat messages */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Wrench className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Admin Console</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ask questions, run commands, fix issues.
              </p>
              <div className="mt-4 space-y-1.5 text-[10px] text-muted-foreground/60">
                <p>"Show idle machines"</p>
                <p>"Check stock levels"</p>
                <p>"How many active orders?"</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "rounded-lg px-3 py-2 text-xs max-w-[90%]",
                msg.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-muted text-foreground"
              )}
            >
              {msg.role === "system" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs [&_p]:mb-1 [&_p]:mt-0">
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

          {isProcessing && (
            <div className="mr-auto bg-muted rounded-lg px-3 py-2 text-xs flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-muted-foreground">Processing...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex gap-1.5">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask or command..."
            className="h-9 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isProcessing}
          />
          <Button size="sm" className="h-9 w-9 p-0 shrink-0" onClick={handleSend} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </aside>
  );
}
