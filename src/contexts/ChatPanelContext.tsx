import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "sonner";

interface ChatPanelContextValue {
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  pendingChannelId: string | null;
  clearPendingChannel: () => void;
  openChatToChannel: (channelId: string) => void;
}

const ChatPanelContext = createContext<ChatPanelContextValue | null>(null);

export function ChatPanelProvider({ children }: { children: ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [pendingChannelId, setPendingChannelId] = useState<string | null>(null);

  const openChatToChannel = useCallback((channelId: string) => {
    setPendingChannelId(channelId);
    setChatOpen(true);
  }, []);

  const clearPendingChannel = useCallback(() => {
    setPendingChannelId(null);
  }, []);

  // Listen for team-chat-incoming custom events from useNotifications
  useEffect(() => {
    const handler = (e: Event) => {
      const { channelId, title, description } = (e as CustomEvent).detail;
      const active = document.activeElement;
      const isTyping =
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA" ||
        (active as HTMLElement)?.isContentEditable;

      if (!isTyping) {
        openChatToChannel(channelId);
      } else {
        toast(title, {
          description,
          duration: 8000,
          action: {
            label: "Open Chat",
            onClick: () => openChatToChannel(channelId),
          },
        });
      }
    };

    window.addEventListener("team-chat-incoming", handler);
    return () => window.removeEventListener("team-chat-incoming", handler);
  }, [openChatToChannel]);

  return (
    <ChatPanelContext.Provider
      value={{ chatOpen, setChatOpen, pendingChannelId, clearPendingChannel, openChatToChannel }}
    >
      {children}
    </ChatPanelContext.Provider>
  );
}

export function useChatPanel() {
  const ctx = useContext(ChatPanelContext);
  if (!ctx) throw new Error("useChatPanel must be used within ChatPanelProvider");
  return ctx;
}
