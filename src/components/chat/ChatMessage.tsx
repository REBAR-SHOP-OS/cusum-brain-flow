import { useState } from "react";
import { cn } from "@/lib/utils";
import { AgentBadge, AgentType } from "./AgentSelector";
import { User, Bot, FileIcon, Download, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSignedFileUrl } from "@/lib/storageUtils";
import { downloadFile } from "@/lib/downloadUtils";
import { UploadedFile } from "./ChatInput";
import { MessageActions } from "./MessageActions";
import { RichMarkdown } from "./RichMarkdown";
import { PixelChatRenderer } from "@/components/social/PixelChatRenderer";
import { PixelPostData } from "@/components/social/PixelPostCard";

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
  onRegenerateImage?: (imageUrl: string, alt: string) => void;
  onViewPost?: (post: PixelPostData) => void;
  onApprovePost?: (post: PixelPostData) => void;
  onRegeneratePost?: (post: PixelPostData) => void;
  agentImage?: string;
  agentName?: string;
  isPixelAgent?: boolean;
}

export function ChatMessage({ message, onRegenerate, onRegenerateImage, onViewPost, onApprovePost, onRegeneratePost, agentImage, agentName, isPixelAgent }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [translation, setTranslation] = useState<{ text: string; lang: string } | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const handleFileDownload = async (file: UploadedFile) => {
    const path = (file as any).path || file.url;
    try {
      setDownloadingFile(path);
      const freshUrl = await getSignedFileUrl(path);
      if (!freshUrl) throw new Error("empty");
      await downloadFile(freshUrl, file.name);
    } catch {
      toast.error("Failed to get download link");
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleTranslate = (translatedText: string, langLabel: string) => {
    setTranslation({ text: translatedText, lang: langLabel });
  };

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
            {message.files.map((file, index) => {
              const filePath = (file as any).path || file.url;
              const isLoading = downloadingFile === filePath;
              return (
                <button
                  key={index}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleFileDownload(file)}
                  className="flex items-center gap-2 bg-secondary/70 hover:bg-secondary rounded-lg px-3 py-2 text-xs transition-colors disabled:opacity-50"
                >
                  <FileIcon className="w-4 h-4" />
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3 opacity-60" />}
                </button>
              );
            })}
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
          ) : isPixelAgent && agentImage && agentName ? (
            <PixelChatRenderer
              content={message.content || ""}
              agentImage={agentImage}
              agentName={agentName}
              onViewPost={onViewPost}
              onRegenerateImage={onRegenerateImage}
              onApprovePost={onApprovePost}
              onRegeneratePost={onRegeneratePost}
            />
          ) : (
            <RichMarkdown content={message.content || ""} onRegenerateImage={onRegenerateImage} />
          )}
        </div>

        {/* Translation block */}
        {translation && (
          <div className="w-full rounded-lg border border-border bg-muted/50 p-3 mt-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                🌐 {translation.lang}
              </span>
              <button
                onClick={() => setTranslation(null)}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" dir="auto">
              {translation.text}
            </p>
          </div>
        )}

        {/* Action buttons for agent messages */}
        {!isUser && message.content && (
          <MessageActions
            content={message.content}
            messageId={message.id}
            onRegenerate={onRegenerate}
            onTranslate={handleTranslate}
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
