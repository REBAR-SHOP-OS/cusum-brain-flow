import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Square, Trash2, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAdminChat } from "@/hooks/useAdminChat";
import { RichMarkdown } from "@/components/chat/RichMarkdown";
import { ScrollArea } from "@/components/ui/scroll-area";

const TOOL_LABELS: Record<string, string> = {
  wp_update_post: "Update WordPress Post",
  wp_update_page: "Update WordPress Page",
  wp_update_product: "Update WooCommerce Product",
  wp_update_order_status: "Update WooCommerce Order",
  wp_create_redirect: "Create 301 Redirect",
};

const QUICK_ACTIONS = [
  "List all pages",
  "Check site health",
  "Show recent posts",
  "List products",
];

interface WebsiteChatProps {
  currentPagePath: string;
  onWriteConfirmed?: () => void;
}

export function WebsiteChat({ currentPagePath, onWriteConfirmed }: WebsiteChatProps) {
  const chat = useAdminChat(`/website`);
  const { messages, isStreaming, pendingAction, sendMessage, confirmAction, cancelAction, clearChat, cancelStream } = chat;

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming || pendingAction) return;
    // Prefix context about the page being viewed
    const contextPrefix = `[Currently viewing: rebar.shop${currentPagePath}]\n`;
    sendMessage(contextPrefix + input.trim());
    setInput("");
  }, [input, isStreaming, currentPagePath, sendMessage]);

  const handleConfirm = useCallback(async () => {
    await confirmAction();
    onWriteConfirmed?.();
  }, [confirmAction, onWriteConfirmed]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && pendingAction) {
      e.preventDefault();
      cancelAction();
    }
  };

  const formatActionArgs = (args: Record<string, any>) => {
    return Object.entries(args)
      .filter(([k]) => k !== "tool_call_id")
      .map(([key, value]) => (
        <div key={key} className="flex justify-between text-xs">
          <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
          <span className="font-mono text-foreground truncate ml-2">{String(value).slice(0, 60)}</span>
        </div>
      ));
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold">AI Job Site Editor</h2>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                Ask me to edit your job site
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {QUICK_ACTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      const contextPrefix = `[Currently viewing: rebar.shop${currentPagePath}]\n`;
                      sendMessage(contextPrefix + q);
                    }}
                    className="text-xs px-2.5 py-1.5 rounded-full border border-border bg-muted hover:bg-accent transition-colors"
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
                "rounded-xl px-3 py-2 text-sm max-w-[95%] overflow-hidden break-words",
                msg.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-muted text-foreground"
              )}
            >
              {msg.role === "assistant" ? (
                <RichMarkdown content={msg.content} className="text-sm [&_p]:text-sm [&_pre]:overflow-x-auto [&_code]:break-all [&_p]:break-words" />
              ) : (
                <p className="whitespace-pre-wrap">
                  {/* Strip the context prefix from display */}
                  {msg.content.replace(/^\[Currently viewing:.*?\]\n/, "")}
                </p>
              )}
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="mr-auto bg-muted rounded-xl px-3 py-2 text-sm flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-muted-foreground">Thinking...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Confirmation Card */}
      {pendingAction && (
        <div className="px-3 pb-2 shrink-0">
          <Card className="border-l-4 border-l-yellow-500 bg-card p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-yellow-500 shrink-0" />
              <p className="text-xs font-semibold">Confirm action</p>
            </div>
            <div className="space-y-1 bg-muted/50 rounded-lg p-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Action</span>
                <span className="font-semibold">{TOOL_LABELS[pendingAction.tool] || pendingAction.tool}</span>
              </div>
              {formatActionArgs(pendingAction.args)}
            </div>
            <div className="flex justify-end gap-1.5">
              <Button variant="outline" size="sm" onClick={cancelAction} disabled={isStreaming} className="h-7 text-xs gap-1">
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={isStreaming} className="h-7 text-xs gap-1 bg-yellow-600 hover:bg-yellow-700 text-white">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={pendingAction ? "Approve or cancel the action above..." : "Edit your job site..."}
            className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            rows={1}
            disabled={isStreaming || !!pendingAction}
          />
          {isStreaming ? (
            <Button size="icon" variant="destructive" className="h-9 w-9 rounded-lg shrink-0" onClick={cancelStream}>
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button size="icon" className="h-9 w-9 rounded-lg shrink-0" onClick={handleSend} disabled={!input.trim() || !!pendingAction}>
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
