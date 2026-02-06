import { cn } from "@/lib/utils";
import { AgentBadge, AgentType } from "./AgentSelector";
import { User, Bot } from "lucide-react";

export interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  agent?: AgentType;
  timestamp: Date;
  status?: "sending" | "sent" | "draft";
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          isUser ? "bg-primary/20" : "bg-secondary"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-primary" />
        ) : (
          <Bot className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
        {/* Agent badge for agent messages */}
        {!isUser && message.agent && (
          <AgentBadge agent={message.agent} />
        )}

        {/* Bubble */}
        <div
          className={cn(
            "chat-bubble",
            isUser ? "chat-bubble-user" : "chat-bubble-agent"
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {message.status === "draft" && (
            <span className="text-warning">Draft — needs approval</span>
          )}
        </div>
      </div>
    </div>
  );
}
