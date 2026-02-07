import { useState, useMemo } from "react";
import { useTeamChannels, useTeamMessages, useSendMessage, useMyProfile } from "@/hooks/useTeamChat";
import { useProfiles } from "@/hooks/useProfiles";
import { ChannelSidebar } from "@/components/teamhub/ChannelSidebar";
import { MessageThread } from "@/components/teamhub/MessageThread";
import { MessageSquare, Globe, Users, Hash, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function TeamHub() {
  const { channels, isLoading: channelsLoading } = useTeamChannels();
  const { profiles } = useProfiles();
  const myProfile = useMyProfile();
  const sendMutation = useSendMessage();

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const activeChannelId = selectedChannelId || channels[0]?.id || null;
  const activeChannel = channels.find((c) => c.id === activeChannelId);

  const { messages, isLoading: msgsLoading } = useTeamMessages(activeChannelId);

  const myLang = myProfile?.preferred_language || "en";

  const targetLangs = useMemo(() => {
    const langs = new Set<string>();
    for (const p of profiles) {
      if (p.is_active && p.preferred_language) {
        langs.add(p.preferred_language);
      }
    }
    return [...langs];
  }, [profiles]);

  const onlineCount = profiles.filter((p) => p.is_active).length;

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
      {/* Ambient glow effects */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-0 -left-20 w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        <ChannelSidebar
          channels={channels}
          selectedId={activeChannelId}
          onSelect={setSelectedChannelId}
          onlineCount={onlineCount}
          profiles={profiles}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {activeChannel ? (
            <MessageThread
              channelName={activeChannel.name}
              channelDescription={activeChannel.description}
              messages={messages}
              profiles={profiles}
              myProfile={myProfile}
              myLang={myLang}
              isLoading={msgsLoading}
              isSending={sendMutation.isPending}
              onSend={handleSend}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <MessageSquare className="w-9 h-9 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Welcome to Team Hub</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Real-time messaging with automatic translation. Select a channel to start.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-4 pt-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Globe className="w-3.5 h-3.5 text-primary" />
                    <span>Auto-translate</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>AI-powered</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span>{onlineCount} members</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
