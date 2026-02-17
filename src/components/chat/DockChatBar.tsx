import { useState, useEffect } from "react";
import { MessageSquare, Hash, Users, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDockChat } from "@/contexts/DockChatContext";
import { DockChatBox } from "./DockChatBox";
import { useTeamChannels, useMyProfile } from "@/hooks/useTeamChat";
import { useProfiles } from "@/hooks/useProfiles";
import { useOpenDM } from "@/hooks/useChannelManagement";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

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
  const openDMMutation = useOpenDM();
  const isMobile = useIsMobile();
  const [launcherOpen, setLauncherOpen] = useState(false);

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

  const groupChannels = channels.filter((c) => c.channel_type === "group");
  const dmChannels = channels.filter((c) => c.channel_type === "dm");

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
      }
    } catch (err: any) {
      toast.error("Failed to open DM", { description: err.message });
    }
  };

  // Calculate visible (non-minimized) boxes for positioning
  const BOX_WIDTH = 330;
  const LAUNCHER_OFFSET = 80; // space for the launcher pill

  return (
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

      {/* Launcher pill */}
      <div className="fixed bottom-0 right-4 z-50">
        <Popover open={launcherOpen} onOpenChange={setLauncherOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-t-lg shadow-lg hover:bg-primary/90 transition-colors text-xs font-semibold">
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-[300px] p-0 mb-1">
            <ScrollArea className="max-h-[400px]">
              {/* Team members - top for visibility */}
              <div className="px-2 pt-2 pb-2">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Start a Chat</p>
                {profiles
                  .filter((p) => p.is_active !== false && p.id !== myProfile?.id)
                  .map((p) => (
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
                      <span className="text-sm text-foreground truncate">{p.full_name}</span>
                    </button>
                  ))}
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
    </>
  );
}
