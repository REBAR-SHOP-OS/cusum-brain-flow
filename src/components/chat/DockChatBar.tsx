import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Hash, Users, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getFloatingPortalContainer } from "@/lib/floatingPortal";
import { useDockChat } from "@/contexts/DockChatContext";
import { DockChatBox } from "./DockChatBox";
import { useTeamChannels, useMyProfile } from "@/hooks/useTeamChat";
import { useProfiles } from "@/hooks/useProfiles";
import { useOpenDM } from "@/hooks/useChannelManagement";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUnreadSenders } from "@/hooks/useUnreadSenders";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";
import { useAuth } from "@/lib/auth";

import { toast } from "sonner";

const CHAT_BTN_SIZE = 56;

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const avatarColors = [
  "bg-violet-500", "bg-amber-500", "bg-pink-500", "bg-teal-500",
  "bg-blue-500", "bg-red-500", "bg-emerald-500", "bg-indigo-500",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function DockChatBar() {
  const { openChats, openChat } = useDockChat();
  const { channels } = useTeamChannels();
  const { profiles } = useProfiles();
  const myProfile = useMyProfile();
  const { user } = useAuth();
  
  const isInternal = (user?.email ?? "").endsWith("@rebar.shop");
  const openDMMutation = useOpenDM();
  const isMobile = useIsMobile();
  const { unreadSenderIds, unreadCounts } = useUnreadSenders();
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);

  useEffect(() => {
    setPortalContainer(getFloatingPortalContainer());
  }, []);


  const { pos, handlers, wasDragged } = useDraggablePosition({
    storageKey: "dock-chat-pos",
    btnSize: CHAT_BTN_SIZE,
    defaultPos: () => ({
      x: typeof window !== "undefined" ? window.innerWidth - CHAT_BTN_SIZE - 24 : 300,
      y: typeof window !== "undefined" ? window.innerHeight - CHAT_BTN_SIZE - 24 : 300,
    }),
  });

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    handlers.onPointerUp(e);
    if (!wasDragged.current) {
      setLauncherOpen((prev) => !prev);
    }
  }, [handlers, wasDragged]);

  // Listen for dock-chat-open events from ChatPanelContext (notifications)
  useEffect(() => {
    const handler = (e: Event) => {
      const { channelId } = (e as CustomEvent).detail;
      const ch = channels.find((c) => c.id === channelId);
      if (ch) {
        openChat(channelId, ch.name, ch.channel_type === "dm" ? "dm" : "group");
      }
    };
    window.addEventListener("dock-chat-open", handler);
    return () => window.removeEventListener("dock-chat-open", handler);
  }, [channels, openChat]);

  // Filter profiles based on domain
  const sortedProfiles = useMemo(() => {
    const filtered = profiles.filter((p) => {
      if (p.id === myProfile?.id) return false;
      if (isInternal) return p.email?.endsWith("@rebar.shop");
      return true;
    });
    return filtered.sort((a, b) => (unreadCounts.get(b.id) ?? 0) - (unreadCounts.get(a.id) ?? 0));
  }, [profiles, myProfile?.id, isInternal, unreadCounts]);

  const groupChannels = channels.filter((c) => c.channel_type === "group");
  const dmChannels = channels.filter((c) => {
    if (c.channel_type !== "dm") return false;
    return sortedProfiles.some(
      (p) => c.name.includes(p.full_name)
    );
  });

  const handleSelectChannel = (id: string, name: string, type: "dm" | "group") => {
    openChat(id, name, type);
    setLauncherOpen(false);
  };

  const handleOpenDM = async (profileId: string, name: string) => {
    if (profileId === myProfile?.id) return;
    try {
      const result = await openDMMutation.mutateAsync({ targetProfileId: profileId, targetName: name });
      if (result?.id) {
        openChat(result.id, name, "dm");
        setLauncherOpen(false);
        // Mark notifications from this sender as read
        if (user) {
          await supabase
            .from("notifications")
            .update({ status: "read" } as any)
            .eq("user_id", user.id)
            .eq("link_to", "/team-hub")
            .eq("status", "unread")
            .filter("metadata->>sender_profile_id", "eq", profileId);
        }
      }
    } catch (err: any) {
      toast.error("Failed to open DM", { description: err.message });
    }
  };

  // Calculate visible (non-minimized) boxes for positioning
  const BOX_WIDTH = 330;
  const LAUNCHER_OFFSET = 80; // space for the launcher pill

  if (!portalContainer) return null;

  return createPortal(
    <>
      {/* Render open chat boxes */}
      {openChats.map((chat, index) => {
        const rightOffset = isMobile ? 0 : LAUNCHER_OFFSET + index * BOX_WIDTH;
        return (
          <DockChatBox
            key={chat.channelId}
            channelId={chat.channelId}
            channelName={chat.channelName}
            channelType={chat.channelType}
            minimized={chat.minimized}
            style={isMobile ? { left: 8, right: 8, width: "auto" } : { right: rightOffset }}
          />
        );
      })}

      {/* Draggable floating chat button */}
      <div
        data-feedback-btn="true"
        className="fixed z-[9999] pointer-events-auto cursor-grab active:cursor-grabbing select-none"
        style={{ left: pos.x, top: pos.y, touchAction: "none" }}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlePointerUp}
      >
        <Popover open={launcherOpen} modal={false}>
          <PopoverAnchor asChild>
            <button
              className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:scale-110 transition-transform ring-2 ring-primary/30 pointer-events-none"
              aria-label="Open Chat"
            >
              <MessageSquare className="w-6 h-6 pointer-events-none" />
            </button>
          </PopoverAnchor>
          <PopoverContent side="top" align="center" className="w-[340px] p-0 mb-2" onPointerDownOutside={(e) => { if ((e.target as HTMLElement)?.closest?.("[data-feedback-btn]")) { e.preventDefault(); return; } setLauncherOpen(false); }} onEscapeKeyDown={() => setLauncherOpen(false)} onInteractOutside={(e) => { if ((e.target as HTMLElement)?.closest?.("[data-feedback-btn]")) { e.preventDefault(); return; } }}>
            <ScrollArea className="max-h-[520px]">
              {/* Team members - top for visibility */}
              <div className="px-2 pt-2 pb-2">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Start a Chat</p>
                {sortedProfiles.map((p) => {
                  const count = unreadCounts.get(p.id) ?? 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleOpenDM(p.id, p.full_name)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left"
                    >
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={p.avatar_url || ""} />
                        <AvatarFallback className={cn("text-[9px] font-bold text-white", getAvatarColor(p.full_name))}>
                          {getInitials(p.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-foreground truncate flex-1">{p.full_name}</span>
                      {count > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold leading-none flex items-center justify-center shrink-0">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Separator */}
              {(groupChannels.length > 0 || dmChannels.length > 0) && <div className="mx-3 h-px bg-border" />}

              {/* Group channels */}
              {groupChannels.length > 0 && (
                <div className="px-2 pt-2">
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Channels</p>
                  {groupChannels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => handleSelectChannel(ch.id, ch.name, "group")}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                    >
                      <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <Hash className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-foreground truncate flex-1">{ch.name}</span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              )}

              {/* DM channels */}
              {dmChannels.length > 0 && (
                <div className="px-2 pt-2 pb-2">
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Direct Messages</p>
                  {dmChannels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => handleSelectChannel(ch.id, ch.name, "dm")}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                    >
                      <div className="w-7 h-7 rounded bg-muted flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-sm text-foreground truncate flex-1">{ch.name}</span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
    </>,
    getFloatingPortalContainer()
  );
}
