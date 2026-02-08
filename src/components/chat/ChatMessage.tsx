import { cn } from "@/lib/utils";
import { AgentBadge, AgentType } from "./AgentSelector";
import { User, Bot, FileIcon, Download } from "lucide-react";
import { UploadedFile } from "./ChatInput";
import { MessageActions } from "./MessageActions";
import { RichMarkdown } from "./RichMarkdown";

export interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  agent?: AgentType;
  timestamp: Date;
  status?: "sending" | "sent" | "draft";
  files?: UploadedFile[];
}

interface ChatMessageProps {
  message: Message;
  onRegenerate?: () => void;
}

export function ChatMessage({ message, onRegenerate }: ChatMessageProps) {
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
      <div className={cn("flex flex-col gap-1 max-w-[80%]", isUser ? "items-end" : "items-start")}>
        {/* Agent badge for agent messages */}
        {!isUser && message.agent && (
          <AgentBadge agent={message.agent} />
        )}

        {/* Files attached */}
        {message.files && message.files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.files.map((file, index) => (
              <a
                key={index}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-secondary/70 hover:bg-secondary rounded-lg px-3 py-2 text-xs transition-colors"
              >
                <FileIcon className="w-4 h-4" />
                <span className="max-w-[120px] truncate">{file.name}</span>
                <Download className="w-3 h-3 opacity-60" />
              </a>
            ))}
          </div>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "chat-bubble",
            isUser ? "chat-bubble-user" : "chat-bubble-agent"
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content || (message.files?.length ? "📎 Files attached" : "")}
            </p>
          ) : (
            <RichMarkdown content={message.content || ""} />
          )}
        </div>

        {/* Action buttons for agent messages */}
        {!isUser && message.content && (
          <MessageActions
            content={message.content}
            messageId={message.id}
            onRegenerate={onRegenerate}
          />
        )}

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
