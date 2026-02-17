import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface DockChat {
  channelId: string;
  channelName: string;
  channelType: "dm" | "group";
  minimized: boolean;
}

interface DockChatContextValue {
  openChats: DockChat[];
  openChat: (channelId: string, name: string, type: "dm" | "group") => void;
  closeChat: (channelId: string) => void;
  toggleMinimize: (channelId: string) => void;
  minimizeAll: () => void;
}

const DockChatContext = createContext<DockChatContextValue | null>(null);

const MAX_DESKTOP = 4;
const MAX_MOBILE = 1;
const DEBOUNCE_MS = 100;

export function DockChatProvider({ children }: { children: ReactNode }) {
  const [openChats, setOpenChats] = useState<DockChat[]>([]);
  const isMobile = useIsMobile();
  const lastOpenRef = useRef(0);

  const openChat = useCallback(
    (channelId: string, name: string, type: "dm" | "group") => {
      const now = Date.now();
      if (now - lastOpenRef.current < DEBOUNCE_MS) return;
      lastOpenRef.current = now;

      setOpenChats((prev) => {
        // Duplicate guard — just un-minimize
        const existing = prev.find((c) => c.channelId === channelId);
        if (existing) {
          return prev.map((c) =>
            c.channelId === channelId ? { ...c, minimized: false } : c
          );
        }

        const max = isMobile ? MAX_MOBILE : MAX_DESKTOP;
        let next = [...prev, { channelId, channelName: name, channelType: type, minimized: false }];

        // Auto-minimize oldest if over limit
        if (next.length > max) {
          next = next.map((c, i) => (i < next.length - max ? { ...c, minimized: true } : c));
        }
        return next;
      });
    },
    [isMobile]
  );

  const closeChat = useCallback((channelId: string) => {
    setOpenChats((prev) => prev.filter((c) => c.channelId !== channelId));
  }, []);

  const toggleMinimize = useCallback((channelId: string) => {
    setOpenChats((prev) =>
      prev.map((c) =>
        c.channelId === channelId ? { ...c, minimized: !c.minimized } : c
      )
    );
  }, []);

  const minimizeAll = useCallback(() => {
    setOpenChats((prev) => prev.map((c) => ({ ...c, minimized: true })));
  }, []);

  return (
    <DockChatContext.Provider value={{ openChats, openChat, closeChat, toggleMinimize, minimizeAll }}>
      {children}
    </DockChatContext.Provider>
  );
}

export function useDockChat() {
  const ctx = useContext(DockChatContext);
  if (!ctx) throw new Error("useDockChat must be used within DockChatProvider");
  return ctx;
}
