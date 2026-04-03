import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Video, VideoOff, Mic, MicOff, MonitorUp, PhoneOff,
  Maximize2, Minimize2, X, ExternalLink, Copy, Check,
  Brain, Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamMeeting } from "@/hooks/useTeamMeetings";
import { useMeetingTranscription } from "@/hooks/useMeetingTranscription";
import { useMeetingRecorder } from "@/hooks/useMeetingRecorder";
import { MeetingNotesPanel } from "@/components/teamhub/MeetingNotesPanel";

interface MeetingRoomProps {
  meeting: TeamMeeting;
  displayName: string;
  onLeave: () => void;
  onEnd: () => void;
  isCreator: boolean;
  profileId: string | null;
}

function parseMeetingMeta(meeting: TeamMeeting): { provider: string; joinUrl: string | null } {
  try {
    if (meeting.notes) {
      const meta = JSON.parse(meeting.notes);
      return { provider: meta.provider || "jitsi", joinUrl: meta.joinUrl || null };
    }
  } catch { /* Not JSON */ }
  return { provider: "jitsi", joinUrl: null };
}

export function MeetingRoom({
  meeting, displayName, onLeave, onEnd, isCreator, profileId,
}: MeetingRoomProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showNotes, setShowNotes] = useState(true);

  const { provider, joinUrl } = useMemo(() => parseMeetingMeta(meeting), [meeting]);
  const isRingCentral = provider === "ringcentral" && !!joinUrl;

  // Live transcription
  const {
    isTranscribing, entries, interimText,
    startTranscription, stopTranscription, isSupported: sttSupported,
  } = useMeetingTranscription(meeting.id, displayName, profileId, meeting.started_at);

  // Audio recording (all participants)
  const { isRecording, startRecording, stopRecording, duration } = useMeetingRecorder(meeting.id);

  // Auto-start transcription + recording on mount
  useEffect(() => {
    if (sttSupported) startTranscription();
    startRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jitsiUrl = useMemo(() => {
    const jitsiDomain = "meet.jit.si";
    const configHash = [
      `config.startWithAudioMuted=${isMuted}`,
      `config.startWithVideoMuted=${isVideoOff || meeting.meeting_type === "audio"}`,
      `config.prejoinPageEnabled=false`,
      `config.disableDeepLinking=true`,
      `config.toolbarButtons=["microphone","camera","desktop","chat","participants","tileview","fullscreen","hangup"]`,
      `config.hideConferenceSubject=true`,
      `config.hideConferenceTimer=false`,
      `config.subject=${encodeURIComponent(meeting.title)}`,
      `config.disableInviteFunctions=true`,
      `interfaceConfig.TOOLBAR_ALWAYS_VISIBLE=true`,
      `interfaceConfig.SHOW_JITSI_WATERMARK=false`,
      `interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false`,
      `interfaceConfig.DEFAULT_BACKGROUND="#0f172a"`,
    ].join("&");
    return `https://${jitsiDomain}/${meeting.room_code}#${configHash}`;
  }, [meeting, isMuted, isVideoOff]);

  const handleOpenMeeting = () => {
    if (joinUrl) window.open(joinUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEnd = async () => {
    stopTranscription();
    if (isRecording) await stopRecording();
    onEnd();
  };

  const handleLeave = () => {
    stopTranscription();
    onLeave();
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const meetingTypeLabel = {
    video: "Video Call",
    audio: "Audio Call",
    screen_share: "Screen Share",
  }[meeting.meeting_type] || "Meeting";

  const providerLabel = provider === "ringcentral" ? "RingCentral" : "Jitsi";

  return (
    <div className={cn(
      "flex h-full bg-[linear-gradient(180deg,rgba(2,6,23,0.78),rgba(15,23,42,0.9))] transition-all",
      isFullscreen ? "fixed inset-0 z-50" : "w-full"
    )}>
      {/* Main meeting area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Meeting Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[rgba(15,23,42,0.72)] px-3 py-3 backdrop-blur-xl md:px-4">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xs font-bold text-white md:text-sm">{meeting.title}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1 border-white/15 bg-white/5 px-1.5 py-0 text-[9px] text-slate-200">
                  {meeting.meeting_type === "video" && <Video className="w-2.5 h-2.5" />}
                  {meeting.meeting_type === "audio" && <Mic className="w-2.5 h-2.5" />}
                  {meeting.meeting_type === "screen_share" && <MonitorUp className="w-2.5 h-2.5" />}
                  {meetingTypeLabel}
                </Badge>
                <Badge variant="secondary" className="bg-white/10 px-1.5 py-0 text-[9px] text-slate-100">{providerLabel}</Badge>
                {isTranscribing && (
                  <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 px-1.5 py-0 text-[9px] text-primary">
                    <Mic className="w-2.5 h-2.5" /> STT
                  </Badge>
                )}
                {isRecording && (
                  <Badge variant="outline" className="gap-1 border-destructive/30 bg-destructive/10 px-1.5 py-0 text-[9px] text-destructive">
                    <Circle className="w-2 h-2 fill-current" /> REC {formatDuration(duration)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant={showNotes ? "secondary" : "ghost"}
              size="icon"
              className={cn(
                "h-8 w-8 rounded-xl border border-white/10 text-slate-200",
                showNotes ? "bg-white/10 hover:bg-white/15" : "bg-transparent hover:bg-white/10"
              )}
              onClick={() => setShowNotes(!showNotes)}
              title="AI Notes Panel"
            >
              <Brain className="w-3.5 h-3.5" />
            </Button>
            {!isRingCentral && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden h-8 w-8 rounded-xl border border-white/10 text-slate-200 hover:bg-white/10 md:inline-flex"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-slate-300" /> : <Maximize2 className="w-3.5 h-3.5 text-slate-300" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl border border-white/10 text-slate-200 hover:bg-white/10" onClick={handleLeave}>
              <X className="w-3.5 h-3.5 text-slate-300" />
            </Button>
          </div>
        </div>

        {/* Meeting Content */}
        <div className="relative flex-1 overflow-hidden bg-black">
          {isRingCentral ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.16),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.94))] px-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-primary/25 bg-primary/12 shadow-[0_0_0_1px_rgba(45,212,191,0.08)]">
                <Video className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-white">RingCentral Video Meeting</h2>
                <p className="max-w-sm text-sm text-slate-300">
                  This meeting opens in RingCentral. Click below to join in a new tab.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleOpenMeeting} className="gap-2 rounded-full">
                  <ExternalLink className="w-4 h-4" /> Join Meeting
                </Button>
                <Button variant="outline" onClick={handleCopyLink} className="gap-2 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Link"}
                </Button>
              </div>
              <p className="max-w-md break-all font-mono text-xs text-slate-400">{joinUrl}</p>
            </div>
          ) : (
            <iframe
              src={jitsiUrl}
              className="w-full h-full border-0"
              allow="camera; microphone; display-capture; autoplay; clipboard-write"
              allowFullScreen
            />
          )}

          {/* Live transcript bar at bottom of video */}
          {(interimText || entries.length > 0) && (
            <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/75 px-4 py-2 backdrop-blur-sm">
              <div className="max-w-2xl mx-auto">
                {entries.length > 0 && (
                  <p className="truncate text-xs text-slate-200">
                    <span className="text-primary font-semibold">{entries[entries.length - 1].speaker_name}:</span>{" "}
                    {entries[entries.length - 1].text}
                  </p>
                )}
                {interimText && (
                  <p className="truncate text-xs italic text-slate-400">{interimText}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="flex items-center justify-center gap-2 border-t border-white/10 bg-[rgba(15,23,42,0.82)] px-3 py-3 backdrop-blur-xl safe-area-bottom md:gap-3 md:px-4">
          {!isRingCentral && (
            <>
              <Button
                variant={isMuted ? "destructive" : "outline"}
                size="sm"
                className={cn(
                  "h-10 w-10 rounded-full border-white/10 p-0 text-white",
                  !isMuted && "bg-white/5 hover:bg-white/10"
                )}
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button
                variant={isVideoOff ? "destructive" : "outline"}
                size="sm"
                className={cn(
                  "h-10 w-10 rounded-full border-white/10 p-0 text-white",
                  !isVideoOff && "bg-white/5 hover:bg-white/10"
                )}
                onClick={() => setIsVideoOff(!isVideoOff)}
              >
                {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </Button>
            </>
          )}

          <Button
            variant="destructive"
            size="sm"
            className="h-10 gap-1.5 rounded-full px-4 shadow-[0_16px_36px_-20px_rgba(239,68,68,0.8)]"
            onClick={() => { if (isCreator) handleEnd(); else handleLeave(); }}
          >
            <PhoneOff className="w-4 h-4" />
            <span className="hidden sm:inline">{isCreator ? "End Meeting" : "Leave"}</span>
          </Button>
        </div>
      </div>

      {/* AI Notes Panel */}
      {showNotes && (
        <div className="hidden lg:flex">
          <MeetingNotesPanel
            meetingId={meeting.id}
            entries={entries}
            interimText={interimText}
            isTranscribing={isTranscribing}
          />
        </div>
      )}
    </div>
  );
}
