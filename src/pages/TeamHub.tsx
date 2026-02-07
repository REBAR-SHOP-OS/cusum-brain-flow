import { useState, useMemo } from "react";
import { useTeamChannels, useTeamMessages, useSendMessage, useMyProfile } from "@/hooks/useTeamChat";
import { useProfiles } from "@/hooks/useProfiles";
import { ChannelSidebar } from "@/components/teamhub/ChannelSidebar";
import { MessageThread } from "@/components/teamhub/MessageThread";
import { ArrowLeft, MessageSquare, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function TeamHub() {
  const { channels, isLoading: channelsLoading } = useTeamChannels();
  const { profiles } = useProfiles();
  const myProfile = useMyProfile();
  const sendMutation = useSendMessage();

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // Auto-select first channel
  const activeChannelId = selectedChannelId || channels[0]?.id || null;
  const activeChannel = channels.find((c) => c.id === activeChannelId);

  const { messages, isLoading: msgsLoading } = useTeamMessages(activeChannelId);

  const myLang = myProfile?.preferred_language || "en";

  // Collect unique languages of all channel members for translation
  const targetLangs = useMemo(() => {
    const langs = new Set<string>();
    for (const p of profiles) {
      if (p.is_active && p.preferred_language) {
        langs.add(p.preferred_language);
      }
    }
    return [...langs];
  }, [profiles]);

  const handleSend = async (text: string) => {
    if (!activeChannelId || !myProfile) {
      toast.error("Cannot send — profile not found");
      return;
    }

    try {
      await sendMutation.mutateAsync({
        channelId: activeChannelId,
        senderProfileId: myProfile.id,
        text,
        senderLang: myLang,
        targetLangs,
      });
    } catch (err: any) {
      toast.error("Failed to send message", { description: err.message });
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-background overflow-hidden">
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-purple-500/8 blur-[150px]" />
      </div>

      {/* Top Bar */}
      <header className="relative z-10 border-b border-border bg-card/80 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
        <Link
          to="/shop-floor"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <MessageSquare className="w-5 h-5 text-purple-500" />
        </div>
        <div>
          <h1 className="text-lg font-black italic text-foreground tracking-tight">TEAM HUB</h1>
          <div className="flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-primary" />
            <p className="text-[10px] tracking-widest text-primary uppercase">
              Auto-translated messaging
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        <ChannelSidebar
          channels={channels}
          selectedId={activeChannelId}
          onSelect={setSelectedChannelId}
        />
        <div className="flex-1 flex flex-col min-w-0">
          {activeChannel ? (
            <MessageThread
              channelName={activeChannel.name}
              messages={messages}
              myProfile={myProfile}
              myLang={myLang}
              isLoading={msgsLoading}
              isSending={sendMutation.isPending}
              onSend={handleSend}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">Select a channel to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
