import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Loader2, Square, Trash2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminChat } from "@/hooks/useAdminChat";
import { RichMarkdown } from "@/components/chat/RichMarkdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import { getUserPrimaryAgent } from "@/lib/userAgentMap";
import assistantHelper from "@/assets/helpers/assistant-helper.png";

export default function LiveChat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const agent = getUserPrimaryAgent(user?.email);
  const avatarImg = agent?.image || assistantHelper;
  const agentName = agent?.name || "Vizzy";

  const [input, setInput] = useState("");
  const { messages, isStreaming, sendMessage, clearChat, cancelStream } = useAdminChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-teal-400 shrink-0">
          <img src={avatarImg} alt={agentName} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">{agentName}</h1>
          <p className="text-xs text-muted-foreground">AI Assistant</p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={clearChat} title="Clear chat">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-teal-400 mx-auto mb-4">
                <img src={avatarImg} alt={agentName} className="w-full h-full object-cover" />
              </div>
              <p className="text-lg font-medium">How can I help you?</p>
              <p className="text-sm text-muted-foreground mt-1">Ask anything about your business</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "rounded-2xl px-4 py-3 text-sm max-w-[85%]",
                msg.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-muted text-foreground"
              )}
            >
              {msg.role === "assistant" ? (
                <RichMarkdown content={msg.content} className="text-sm [&_p]:text-sm" />
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="mr-auto bg-muted rounded-2xl px-4 py-3 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-muted-foreground">Thinking...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border bg-card p-4 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 min-h-[44px] max-h-[120px] text-sm resize-none bg-secondary rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30"
            rows={1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button size="icon" variant="destructive" className="h-11 w-11 rounded-xl shrink-0" onClick={cancelStream}>
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={handleSend} disabled={!input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
