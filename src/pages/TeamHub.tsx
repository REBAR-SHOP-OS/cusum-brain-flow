import { useState, useMemo } from "react";
import { useTeamChannels, useTeamMessages, useSendMessage, useMyProfile, type ChatAttachment } from "@/hooks/useTeamChat";
import { useProfiles } from "@/hooks/useProfiles";
import { useCreateChannel, useOpenDM } from "@/hooks/useChannelManagement";
import { useActiveMeetings, useStartMeeting, useEndMeeting } from "@/hooks/useTeamMeetings";
import type { TeamMeeting } from "@/hooks/useTeamMeetings";
import { ChannelSidebar } from "@/components/teamhub/ChannelSidebar";
import { MessageThread } from "@/components/teamhub/MessageThread";
import { CreateChannelDialog } from "@/components/teamhub/CreateChannelDialog";
import { StartMeetingDialog } from "@/components/teamhub/StartMeetingDialog";
import { MeetingRoom } from "@/components/teamhub/MeetingRoom";
import { MeetingReportDialog } from "@/components/teamhub/MeetingReportDialog";
import { MessageSquare, Globe, Users, Sparkles, Menu, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";

export default function TeamHub() {
  const { channels, isLoading: channelsLoading } = useTeamChannels();
  const { profiles } = useProfiles();
  const myProfile = useMyProfile();
  const sendMutation = useSendMessage();
  const createChannelMutation = useCreateChannel();
  const openDMMutation = useOpenDM();
  const startMeetingMutation = useStartMeeting();
  const endMeetingMutation = useEndMeeting();

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<TeamMeeting | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reportMeetingId, setReportMeetingId] = useState<string | null>(null);

  const activeChannelId = selectedChannelId || (channelsLoading ? null : channels[0]?.id || null);
  const activeChannel = channels.find((c) => c.id === activeChannelId);

  const { messages, isLoading: msgsLoading } = useTeamMessages(activeChannelId);
  const { meetings: activeMeetings } = useActiveMeetings(activeChannelId);

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

  const handleSend = async (text: string, attachments?: ChatAttachment[]) => {
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
        attachments,
      });
    } catch (err: any) {
      toast.error("Failed to send message", { description: err.message });
    }
  };

  const handleCreateChannel = async (data: {
    name: string;
    description: string;
    memberIds: string[];
  }) => {
    try {
      const result = await createChannelMutation.mutateAsync(data);
      setShowCreateDialog(false);
      if (result?.id) {
        setSelectedChannelId(result.id);
      }
      toast.success(`Channel #${data.name} created!`);
    } catch (err: any) {
      toast.error("Failed to create channel", { description: err.message });
    }
  };

  const handleStartMeeting = async (title: string, type: "video" | "audio" | "screen_share", _isExternal?: boolean) => {
    if (!activeChannelId) return;
    try {
      const meeting = await startMeetingMutation.mutateAsync({
        channelId: activeChannelId,
        title,
        meetingType: type,
      });
      setShowMeetingDialog(false);
      setActiveMeeting(meeting);
      toast.success("Meeting started!");
    } catch (err: any) {
      toast.error("Failed to start meeting", { description: err.message });
    }
  };

  const handleEndMeeting = async () => {
    if (!activeMeeting) return;
    const meetingId = activeMeeting.id;
    try {
      await endMeetingMutation.mutateAsync(meetingId);
      setActiveMeeting(null);
      toast.success("Meeting ended — AI is summarizing...");
      // Show report dialog after a short delay to allow AI processing
      setTimeout(() => setReportMeetingId(meetingId), 3000);
    } catch (err: any) {
      toast.error("Failed to end meeting", { description: err.message });
    }
  };

  const handleLeaveMeeting = () => {
    setActiveMeeting(null);
  };

  const sidebarContent = (
    <ChannelSidebar
      channels={channels}
      selectedId={activeChannelId}
      onSelect={setSelectedChannelId}
      onlineCount={onlineCount}
      profiles={profiles}
      onCreateChannel={() => setShowCreateDialog(true)}
      onClickMember={async (profileId, name) => {
        if (profileId === myProfile?.id) return;
        try {
          const result = await openDMMutation.mutateAsync({
            targetProfileId: profileId,
            targetName: name,
          });
          if (result?.id) {
            setSelectedChannelId(result.id);
          }
        } catch (err: any) {
          toast.error("Failed to open DM", { description: err.message });
        }
      }}
      onClose={() => setSidebarOpen(false)}
    />
  );

  return (
    <div className="relative flex flex-col h-full bg-background overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-0 -left-20 w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Mobile sidebar sheet */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-[280px] sm:w-[320px]">
            {sidebarContent}
          </SheetContent>
        </Sheet>

        {/* Desktop/tablet sidebar */}
        <div className="hidden md:flex">
          {sidebarContent}
        </div>

        {/* Chat + Meeting split */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top bar with hamburger */}
          <div className="flex md:hidden items-center gap-2 px-3 py-2 border-b border-border bg-card/50 backdrop-blur-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-4 h-4" />
            </Button>
            {activeChannel && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-bold text-foreground truncate">#{activeChannel.name}</span>
              </div>
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 flex min-w-0 overflow-hidden">
            {/* Message Thread */}
            <div className={activeMeeting ? "flex-1 min-w-0 hidden lg:flex lg:flex-col" : "flex-1 flex flex-col min-w-0"}>
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
                  activeMeetings={activeMeetings}
                  onStartMeeting={() => setShowMeetingDialog(true)}
                  onJoinMeeting={(m) => setActiveMeeting(m)}
                />
              ) : channelsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full px-6">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                      <MessageSquare className="w-7 h-7 md:w-9 md:h-9 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg md:text-xl font-bold text-foreground">Welcome to Team Hub</h2>
                      <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-sm">
                        Real-time messaging with automatic translation. Select a channel to start.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 md:gap-4 pt-2 flex-wrap">
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="md:hidden mt-2"
                      onClick={() => setSidebarOpen(true)}
                    >
                      <Menu className="w-4 h-4 mr-1.5" />
                      Browse Channels
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Meeting Room Panel */}
            {activeMeeting && (
              <div className="flex-1 min-w-0 lg:max-w-[60%]">
                <MeetingRoom
                  meeting={activeMeeting}
                  displayName={myProfile?.full_name || "Guest"}
                  onLeave={handleLeaveMeeting}
                  onEnd={handleEndMeeting}
                  isCreator={activeMeeting.started_by === myProfile?.id}
                  profileId={myProfile?.id || null}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <CreateChannelDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        profiles={profiles}
        onCreateChannel={handleCreateChannel}
        isCreating={createChannelMutation.isPending}
      />
      <StartMeetingDialog
        open={showMeetingDialog}
        onOpenChange={setShowMeetingDialog}
        channelName={activeChannel?.name || ""}
        onStart={handleStartMeeting}
        isStarting={startMeetingMutation.isPending}
      />
      {reportMeetingId && (
        <MeetingReportDialog
          open={!!reportMeetingId}
          onOpenChange={(open) => { if (!open) setReportMeetingId(null); }}
          meetingId={reportMeetingId}
        />
      )}
    </div>
  );
}
