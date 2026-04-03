import { useState, useMemo, useEffect } from "react";
import { useTeamChannels, useTeamMessages, useSendMessage, useMyProfile, type ChatAttachment, type TeamMessage } from "@/hooks/useTeamChat";
import { useProfiles } from "@/hooks/useProfiles";
import { useCreateChannel, useOpenDM, useDeleteChannel } from "@/hooks/useChannelManagement";
import { useActiveMeetings, useStartMeeting, useEndMeeting } from "@/hooks/useTeamMeetings";
import type { TeamMeeting } from "@/hooks/useTeamMeetings";
import { ChannelSidebar } from "@/components/teamhub/ChannelSidebar";
import { MessageThread } from "@/components/teamhub/MessageThread";
import { CreateChannelDialog } from "@/components/teamhub/CreateChannelDialog";
import { supabase } from "@/integrations/supabase/client";
import { StartMeetingDialog } from "@/components/teamhub/StartMeetingDialog";
import { MeetingRoom } from "@/components/teamhub/MeetingRoom";
import { MeetingReportDialog } from "@/components/teamhub/MeetingReportDialog";
import { ForwardMessageDialog } from "@/components/teamhub/ForwardMessageDialog";
import { BackgroundThemePicker, useTeamHubTheme } from "@/components/teamhub/BackgroundThemePicker";
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
  const deleteChannelMutation = useDeleteChannel();
  const startMeetingMutation = useStartMeeting();
  const endMeetingMutation = useEndMeeting();

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDialogMode, setCreateDialogMode] = useState<"channel" | "group">("channel");
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<TeamMeeting | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reportMeetingId, setReportMeetingId] = useState<string | null>(null);
  const [forwardMsg, setForwardMsg] = useState<TeamMessage | null>(null);
  const [selfChannelId, setSelfChannelId] = useState<string | null>(null);
  const { themeId, theme, setTheme } = useTeamHubTheme();

  const isNotesView = selectedChannelId === "__my_notes__";

  // Resolve self-DM channel for My Notes
  useEffect(() => {
    if (!isNotesView || !myProfile) {
      setSelfChannelId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("create_dm_channel" as any, {
          _my_profile_id: myProfile.id,
          _target_profile_id: myProfile.id,
        });
        if (!cancelled && !error && data) {
          setSelfChannelId(data as string);
        }
      } catch (e) {
        console.error("Failed to resolve self-notes channel", e);
      }
    })();
    return () => { cancelled = true; };
  }, [isNotesView, myProfile?.id]);

  const resolvedChannelId = isNotesView ? selfChannelId : (selectedChannelId || (channelsLoading ? null : channels[0]?.id || null));
  const activeChannelId = resolvedChannelId;
  const activeChannel = channels.find((c) => c.id === activeChannelId);

  const { messages, isLoading: msgsLoading } = useTeamMessages(activeChannelId);
  const { meetings: activeMeetings } = useActiveMeetings(activeChannelId);

  const [activeLang, setActiveLang] = useState<string | null>(null);
  const myLang = activeLang || myProfile?.preferred_language || "en";

  // Channel write restrictions
  const CHANNEL_WRITERS = ["sattar@rebar.shop", "radin@rebar.shop", "neel@rebar.shop"];
  const isOfficialChannel = activeChannel?.name === "Official Channel";
  const canWrite = !isOfficialChannel || CHANNEL_WRITERS.includes(myProfile?.email ?? "");

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
  const activeLabel = isNotesView
    ? "My Notes"
    : activeChannel
      ? `#${activeChannel.name}`
      : channelsLoading
        ? "Syncing channels"
        : "Select a channel";

  const handleSend = async (text: string, attachments?: ChatAttachment[], replyToId?: string | null) => {
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
        replyToId,
      });
    } catch (err: any) {
      toast.error("Failed to send message", { description: err.message });
    }
  };

  const handleForward = async (targetChannelId: string, msg: TeamMessage) => {
    if (!myProfile) return;
    const forwardPrefix = `↪ Forwarded from ${msg.sender?.full_name || "Unknown"}:\n`;
    const text = forwardPrefix + msg.original_text;
    try {
      await sendMutation.mutateAsync({
        channelId: targetChannelId,
        senderProfileId: myProfile.id,
        text,
        senderLang: myLang,
        targetLangs,
        attachments: msg.attachments || [],
      });
      toast.success("Message forwarded");
    } catch (err: any) {
      toast.error("Failed to forward", { description: err.message });
    }
  };

  const handleForwardToMember = async (profileId: string, msg: TeamMessage) => {
    if (!myProfile) return;
    try {
      const result = await openDMMutation.mutateAsync({ targetProfileId: profileId });
      if (result?.id) {
        const forwardPrefix = `↪ Forwarded from ${msg.sender?.full_name || "Unknown"}:\n`;
        await sendMutation.mutateAsync({
          channelId: result.id,
          senderProfileId: myProfile.id,
          text: forwardPrefix + msg.original_text,
          senderLang: myLang,
          targetLangs,
          attachments: msg.attachments || [],
        });
        toast.success("Message forwarded");
      }
    } catch (err: any) {
      toast.error("Failed to forward", { description: err.message });
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
      selectedId={isNotesView ? "__my_notes__" : activeChannelId}
      onSelect={setSelectedChannelId}
      onlineCount={onlineCount}
      profiles={profiles}
      onCreateChannel={() => { setCreateDialogMode("channel"); setShowCreateDialog(true); }}
      onCreateGroup={() => { setCreateDialogMode("group"); setShowCreateDialog(true); }}
      myProfile={myProfile}
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
      onDeleteChannel={async (id) => {
        try {
          await deleteChannelMutation.mutateAsync(id);
          if (selectedChannelId === id) setSelectedChannelId(null);
          toast.success("Channel deleted");
        } catch (err: any) {
          toast.error("Failed to delete", { description: err.message });
        }
      }}
      onClose={() => setSidebarOpen(false)}
    />
  );

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[hsl(var(--dashboard-reference-bg))]"
      style={theme.style}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            "radial-gradient(circle at top right, rgba(45, 212, 191, 0.16), transparent 26%)",
            "radial-gradient(circle at bottom left, rgba(99, 102, 241, 0.18), transparent 24%)",
            "linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "auto, auto, 44px 44px, 44px 44px",
          backgroundPosition: "center, center, -1px -1px, -1px -1px",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.08),rgba(2,6,23,0.5))] pointer-events-none" />

      <div className="relative z-10 px-3 pb-3 pt-3 md:px-5 md:pb-5 md:pt-5">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(15,23,42,0.68))] px-4 py-4 shadow-[0_40px_120px_-48px_rgba(15,23,42,0.95)] backdrop-blur-xl md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/80">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Team communication, upgraded
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Team Hub</h1>
                <p className="max-w-2xl text-sm text-slate-300">
                  Messaging, translation, and meetings stay exactly where they are. The experience is cleaner, denser,
                  and more polished.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200">
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                <span>{onlineCount} active</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span>Auto-translated</span>
              </div>
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200">
                <MessageSquare className="h-3.5 w-3.5 text-sky-300" />
                <span className="truncate">{activeLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-0 flex-1 px-3 pb-3 md:px-5 md:pb-5">
        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.62))] shadow-[0_30px_90px_-44px_rgba(15,23,42,0.9)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.1),transparent_26%)]" />

          {/* Mobile sidebar sheet */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent
              side="left"
              className="w-[300px] border-r border-white/10 bg-[hsl(var(--dashboard-reference-sidebar))/0.96] p-0 shadow-[0_24px_60px_-32px_rgba(2,6,23,0.95)] sm:w-[340px]"
            >
              {sidebarContent}
            </SheetContent>
          </Sheet>

          {/* Desktop/tablet sidebar */}
          <div className="relative hidden border-r border-white/10 bg-[rgba(2,6,23,0.18)] md:flex">
            {sidebarContent}
          </div>

          {/* Chat + Meeting split */}
          <div className="relative flex min-w-0 flex-1 flex-col">
            {/* Mobile top bar with hamburger */}
            <div className="flex items-center gap-3 border-b border-white/10 bg-[rgba(15,23,42,0.55)] px-3 py-3 backdrop-blur-sm md:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Current workspace</p>
                <p className="truncate text-sm font-semibold text-white">{activeLabel}</p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-slate-300">
                <Users className="h-3 w-3 text-emerald-400" />
                {onlineCount}
              </div>
            </div>

            {/* Content area */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* Message Thread */}
              <div className={activeMeeting ? "hidden min-w-0 flex-1 lg:flex lg:flex-col" : "flex min-w-0 flex-1 flex-col"}>
                {isNotesView && myProfile && selfChannelId ? (
                  <MessageThread
                    channelName="My Notes"
                    channelDescription="Your private saved messages"
                    messages={messages}
                    profiles={profiles}
                    myProfile={myProfile}
                    myLang={myLang}
                    isLoading={msgsLoading}
                    isSending={sendMutation.isPending}
                    onSend={handleSend}
                    activeMeetings={[]}
                    onStartMeeting={() => {}}
                    onJoinMeeting={() => {}}
                    readOnly={false}
                    onForward={(msg) => setForwardMsg(msg)}
                    onLangChange={setActiveLang}
                    headerExtra={<BackgroundThemePicker themeId={themeId} onSelect={setTheme} />}
                  />
                ) : isNotesView ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                  </div>
                ) : activeChannel ? (
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
                    readOnly={!canWrite}
                    onForward={(msg) => setForwardMsg(msg)}
                    onLangChange={setActiveLang}
                    headerExtra={<BackgroundThemePicker themeId={themeId} onSelect={setTheme} />}
                  />
                ) : channelsLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center px-6">
                    <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.58),rgba(15,23,42,0.34))] px-8 py-10 text-center shadow-[0_24px_80px_-40px_rgba(15,23,42,0.9)] backdrop-blur-sm">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-primary/25 bg-primary/12 shadow-[0_0_0_1px_rgba(45,212,191,0.08)]">
                        <MessageSquare className="h-9 w-9 text-primary" />
                      </div>
                      <div className="mt-5 space-y-2">
                        <h2 className="text-xl font-semibold text-white md:text-2xl">Welcome to Team Hub</h2>
                        <p className="mx-auto max-w-md text-sm leading-6 text-slate-300">
                          Real-time messaging with automatic translation and meetings. Select a channel to jump in.
                        </p>
                      </div>
                      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">
                          <Globe className="h-3.5 w-3.5 text-primary" />
                          <span>Auto-translate</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span>AI-powered</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">
                          <Users className="h-3.5 w-3.5 text-emerald-400" />
                          <span>{onlineCount} members</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-6 border-white/10 bg-white/5 text-white hover:bg-white/10 md:hidden"
                        onClick={() => setSidebarOpen(true)}
                      >
                        <Menu className="mr-1.5 h-4 w-4" />
                        Browse channels
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Meeting Room Panel */}
              {activeMeeting && (
                <div className="min-w-0 flex-1 border-l border-white/10 lg:max-w-[60%]">
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
      </div>

      {/* Dialogs */}
      <CreateChannelDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        profiles={profiles}
        onCreateChannel={handleCreateChannel}
        isCreating={createChannelMutation.isPending}
        mode={createDialogMode}
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
      <ForwardMessageDialog
        open={!!forwardMsg}
        onOpenChange={(open) => { if (!open) setForwardMsg(null); }}
        message={forwardMsg}
        channels={channels}
        currentChannelId={activeChannelId}
        onForward={handleForward}
        profiles={profiles}
        onForwardToMember={handleForwardToMember}
        currentProfileId={myProfile?.id}
      />
    </div>
  );
}
