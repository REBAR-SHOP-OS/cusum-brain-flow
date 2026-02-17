import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, MessageSquare, Hash, Users, ChevronRight, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTeamChannels, useTeamMessages, useSendMessage, useMyProfile } from "@/hooks/useTeamChat";
import { useProfiles } from "@/hooks/useProfiles";
import { useOpenDM } from "@/hooks/useChannelManagement";
import { useChatPanel } from "@/contexts/ChatPanelContext";
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

interface GlobalChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalChatPanel({ open, onClose }: GlobalChatPanelProps) {
  const navigate = useNavigate();
  const { channels, isLoading } = useTeamChannels();
  const { profiles } = useProfiles();
  const myProfile = useMyProfile();
  const openDMMutation = useOpenDM();
  const sendMutation = useSendMessage();
  const { pendingChannelId, clearPendingChannel } = useChatPanel();

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // Auto-select channel when opened via notification
  useEffect(() => {
    if (open && pendingChannelId) {
      setSelectedChannelId(pendingChannelId);
      clearPendingChannel();
    }
  }, [open, pendingChannelId, clearPendingChannel]);
  const selectedChannel = channels.find((c) => c.id === selectedChannelId);
  const { messages, isLoading: msgsLoading } = useTeamMessages(selectedChannelId);

  const myLang = myProfile?.preferred_language || "en";
  const targetLangs = useMemo(() => {
    const langs = new Set<string>();
    for (const p of profiles) {
      if (p.is_active && p.preferred_language) langs.add(p.preferred_language);
    }
    return [...langs];
  }, [profiles]);

  const [inputText, setInputText] = useState("");

  const handleSend = async () => {
    if (!inputText.trim() || !selectedChannelId || !myProfile) return;
    const text = inputText.trim();
    setInputText("");
    try {
      await sendMutation.mutateAsync({
        channelId: selectedChannelId,
        senderProfileId: myProfile.id,
        text,
        senderLang: myLang,
        targetLangs,
      });
    } catch (err: any) {
      toast.error("Failed to send", { description: err.message });
    }
  };

  const handleOpenDM = async (profileId: string, name: string) => {
    if (profileId === myProfile?.id) return;
    try {
      const result = await openDMMutation.mutateAsync({ targetProfileId: profileId, targetName: name });
      if (result?.id) setSelectedChannelId(result.id);
    } catch (err: any) {
      toast.error("Failed to open DM", { description: err.message });
    }
  };

  const groupChannels = channels.filter((c) => c.channel_type === "group");
  const dmChannels = channels.filter((c) => c.channel_type === "dm");

  if (!open) return null;

  // Channel list view
  if (!selectedChannelId) {
    return (
      <div className="fixed top-[46px] right-0 w-[360px] h-[calc(100vh-46px)] bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-5 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Team Chat</h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
              {channels.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => { onClose(); navigate("/team-hub"); }}
              title="Open full Team Hub"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Channel list */}
        <ScrollArea className="flex-1">
          {/* Group channels */}
          {groupChannels.length > 0 && (
            <div className="px-2 pt-2">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Channels</p>
              {groupChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannelId(ch.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Hash className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ch.name}</p>
                    {ch.description && (
                      <p className="text-[11px] text-muted-foreground truncate">{ch.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}

          {/* DMs */}
          {dmChannels.length > 0 && (
            <div className="px-2 pt-2">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Direct Messages</p>
              {dmChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannelId(ch.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ch.name}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}

          {/* Team members for quick DM */}
          <div className="px-2 pt-3 pb-2">
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Team Members</p>
            {profiles
              .filter((p) => p.is_active !== false && p.id !== myProfile?.id)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleOpenDM(p.id, p.full_name)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left"
                >
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={p.avatar_url || ""} />
                    <AvatarFallback className={cn("text-[10px] font-bold text-white", getAvatarColor(p.full_name))}>
                      {getInitials(p.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-foreground truncate">{p.full_name}</span>
                  {p.preferred_language && p.preferred_language !== "en" && (
                    <span className="text-[10px] text-muted-foreground ml-auto">{p.preferred_language.toUpperCase()}</span>
                  )}
                </button>
              ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Chat view for selected channel
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  return (
    <div className="fixed top-[46px] right-0 w-[360px] h-[calc(100vh-46px)] bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-5 duration-200">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedChannelId(null)}>
          <ChevronRight className="w-4 h-4 rotate-180" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">
            {selectedChannel?.channel_type === "group" ? "#" : ""}{selectedChannel?.name}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => { onClose(); navigate("/team-hub"); }}
          title="Open full Team Hub"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-2">
        {msgsLoading ? (
          <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No messages yet</p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const sender = profileMap.get(msg.sender_profile_id);
              const isMe = msg.sender_profile_id === myProfile?.id;
              const displayText =
                !isMe && msg.translations && msg.translations[myLang]
                  ? msg.translations[myLang]
                  : msg.original_text;
              return (
                <div key={msg.id} className="flex gap-2">
                  <Avatar className="w-6 h-6 mt-0.5 shrink-0">
                    <AvatarImage src={sender?.avatar_url || ""} />
                    <AvatarFallback className={cn("text-[9px] font-bold text-white", getAvatarColor(sender?.full_name || "?"))}>
                      {getInitials(sender?.full_name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-semibold text-foreground">{sender?.full_name || "Unknown"}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 break-words">{displayText}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-2">
        <div className="flex gap-1.5">
          <input
            className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Type a message…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button size="sm" className="h-9 px-3" onClick={handleSend} disabled={!inputText.trim() || sendMutation.isPending}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
