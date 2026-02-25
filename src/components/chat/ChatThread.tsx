import { useRef, useEffect } from "react";
import { Bot } from "lucide-react";
import { ChatMessage, Message } from "./ChatMessage";
import { PixelPostData } from "@/components/social/PixelPostCard";

interface ChatThreadProps {
  messages: Message[];
  isLoading?: boolean;
  onRegenerateImage?: (imageUrl: string, alt: string) => void;
  onViewPost?: (post: PixelPostData) => void;
  onApprovePost?: (post: PixelPostData) => void;
  onRegeneratePost?: (post: PixelPostData) => void;
  agentImage?: string;
  agentName?: string;
  isPixelAgent?: boolean;
  pendingPixelSlot?: number | null;
  hasUnsavedPixelPost?: boolean;
  onApprovePixelSlot?: () => void;
}

export function ChatThread({ messages, isLoading, onRegenerateImage, onViewPost, onApprovePost, onRegeneratePost, agentImage, agentName, isPixelAgent }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🤖</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">Select an agent to start</h3>
          <p className="text-muted-foreground text-sm">
            Choose an agent above, then describe what you need. The agent will draft actions for your approval.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          onRegenerateImage={onRegenerateImage}
          onViewPost={onViewPost}
          onApprovePost={onApprovePost}
          onRegeneratePost={onRegeneratePost}
          agentImage={agentImage}
          agentName={agentName}
          isPixelAgent={isPixelAgent}
        />
      ))}
      {isLoading && (
        <div className="flex gap-3 items-start animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="bg-secondary/50 rounded-2xl px-4 py-3 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-muted-foreground ml-1">Thinking...</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
