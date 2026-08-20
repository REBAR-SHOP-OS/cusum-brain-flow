import { useRef, useEffect } from "react";
import { Bot, User } from "lucide-react";
import type { ChatMessage } from "@/lib/agent";
import ReactMarkdown from "react-markdown";

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function AppBuilderChat({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
          <Bot className="w-7 h-7 text-orange-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Architect Agent</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Ask me to diagnose rebar.shop, check the ERP, modify your plan, or build new features.
          Use the prompt bar below to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          {msg.role === "assistant" && (
            <div className="w-8 h-8 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-4 h-4 text-orange-400" />
            </div>
          )}
          <div
            className={`rounded-2xl px-4 py-3 max-w-[75%] text-sm ${
              msg.role === "user"
                ? "bg-orange-500/15 text-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            {msg.role === "assistant" ? (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            )}
          </div>
          {msg.role === "user" && (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>
      ))}
      {isLoading && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-orange-400 animate-pulse" />
          </div>
          <div className="bg-muted rounded-2xl px-4 py-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
