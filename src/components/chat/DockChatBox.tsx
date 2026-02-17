import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, X, Maximize2, Send, Hash, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTeamMessages, useSendMessage, useMyProfile } from "@/hooks/useTeamChat";
import { useProfiles } from "@/hooks/useProfiles";
import { useDockChat } from "@/contexts/DockChatContext";
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

interface DockChatBoxProps {
  channelId: string;
  channelName: string;
  channelType: "dm" | "group";
  minimized: boolean;
  style?: React.CSSProperties;
}

export function DockChatBox({ channelId, channelName, channelType, minimized, style }: DockChatBoxProps) {
  const navigate = useNavigate();
  const { closeChat, toggleMinimize } = useDockChat();
  const { messages, isLoading } = useTeamMessages(channelId);
  const { profiles } = useProfiles();
  const myProfile = useMyProfile();
  const sendMutation = useSendMessage();
  const [inputText, setInputText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const myLang = myProfile?.preferred_language || "en";
  const targetLangs = useMemo(() => {
    const langs = new Set<string>();
    for (const p of profiles) {
      if (p.is_active && p.preferred_language) langs.add(p.preferred_language);
    }
    return [...langs];
  }, [profiles]);

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  useEffect(() => {
    if (!minimized) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, minimized]);

  const handleSend = async () => {
    if (!inputText.trim() || !myProfile) return;
    const text = inputText.trim();
    setInputText("");
    try {
      await sendMutation.mutateAsync({
        channelId,
        senderProfileId: myProfile.id,
        text,
        senderLang: myLang,
        targetLangs,
      });
    } catch (err: any) {
      toast.error("Failed to send", { description: err.message });
    }
  };

  const ChannelIcon = channelType === "group" ? Hash : Users;

  // Minimized state — just the header bar
  if (minimized) {
    return (
      <div
        style={style}
        className="fixed bottom-0 z-50 w-[320px] cursor-pointer"
        onClick={() => toggleMinimize(channelId)}
      >
        <div className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-t-lg shadow-lg">
          <ChannelIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs font-semibold truncate flex-1">{channelName}</span>
          <button
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); closeChat(channelId); }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={style}
      className="fixed bottom-0 z-50 w-[320px] flex flex-col bg-card border border-border rounded-t-lg shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-t-lg">
        <ChannelIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-xs font-semibold truncate flex-1">{channelName}</span>
        <button
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/20"
          onClick={() => { closeChat(channelId); navigate("/team-hub"); }}
          title="Open full Team Hub"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
        <button
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/20"
          onClick={() => toggleMinimize(channelId)}
          title="Minimize"
        >
          <Minus className="w-3 h-3" />
        </button>
        <button
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/20"
          onClick={() => closeChat(channelId)}
          title="Close"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea className="h-[300px] px-3 py-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No messages yet</p>
        ) : (
          <div className="space-y-2.5">
            {messages.map((msg) => {
              const sender = profileMap.get(msg.sender_profile_id);
              const isMe = msg.sender_profile_id === myProfile?.id;
              const displayText =
                !isMe && msg.translations && msg.translations[myLang]
                  ? msg.translations[myLang]
                  : msg.original_text;
              return (
                <div key={msg.id} className="flex gap-1.5">
                  <Avatar className="w-5 h-5 mt-0.5 shrink-0">
                    <AvatarImage src={sender?.avatar_url || ""} />
                    <AvatarFallback className={cn("text-[8px] font-bold text-white", getAvatarColor(sender?.full_name || "?"))}>
                      {getInitials(sender?.full_name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[11px] font-semibold text-foreground">{sender?.full_name || "Unknown"}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/90 break-words">{displayText}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-2">
        <div className="flex gap-1">
          <input
            className="flex-1 h-8 rounded border border-border bg-background px-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Type a message…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button size="sm" className="h-8 w-8 p-0" onClick={handleSend} disabled={!inputText.trim() || sendMutation.isPending}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
