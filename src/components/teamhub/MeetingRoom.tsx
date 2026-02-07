import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  Maximize2,
  Minimize2,
  Users,
  X,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamMeeting } from "@/hooks/useTeamMeetings";

interface MeetingRoomProps {
  meeting: TeamMeeting;
  displayName: string;
  onLeave: () => void;
  onEnd: () => void;
  isCreator: boolean;
}

function parseMeetingMeta(meeting: TeamMeeting): { provider: string; joinUrl: string | null } {
  try {
    if (meeting.notes) {
      const meta = JSON.parse(meeting.notes);
      return {
        provider: meta.provider || "jitsi",
        joinUrl: meta.joinUrl || null,
      };
    }
  } catch {
    // Not JSON, ignore
  }
  return { provider: "jitsi", joinUrl: null };
}

export function MeetingRoom({
  meeting,
  displayName,
  onLeave,
  onEnd,
  isCreator,
}: MeetingRoomProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [copied, setCopied] = useState(false);

  const { provider, joinUrl } = useMemo(() => parseMeetingMeta(meeting), [meeting]);

  // For RingCentral, we can't iframe — open in new tab automatically on mount
  const isRingCentral = provider === "ringcentral" && !!joinUrl;

  // Build Jitsi URL for iframe fallback
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

  const meetingTypeLabel = {
    video: "Video Call",
    audio: "Audio Call",
    screen_share: "Screen Share",
  }[meeting.meeting_type] || "Meeting";

  const providerLabel = provider === "ringcentral" ? "RingCentral" : "Jitsi";

  return (
    <div
      className={cn(
        "flex flex-col bg-background border-l border-border transition-all",
        isFullscreen
          ? "fixed inset-0 z-50"
          : "w-full h-full"
      )}
    >
      {/* Meeting Header */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs md:text-sm font-bold text-foreground truncate">{meeting.title}</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1">
                {meeting.meeting_type === "video" && <Video className="w-2.5 h-2.5" />}
                {meeting.meeting_type === "audio" && <Mic className="w-2.5 h-2.5" />}
                {meeting.meeting_type === "screen_share" && <MonitorUp className="w-2.5 h-2.5" />}
                {meetingTypeLabel}
              </Badge>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                {providerLabel}
              </Badge>
              <span className="text-[10px] text-muted-foreground">LIVE</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isRingCentral && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hidden md:inline-flex"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onLeave}
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Meeting Content */}
      <div className="flex-1 bg-black relative">
        {isRingCentral ? (
          /* RingCentral: can't iframe, show join panel */
          <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center bg-gradient-to-b from-card to-background">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Video className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">RingCentral Video Meeting</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                This meeting opens in RingCentral. Click below to join in a new tab.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleOpenMeeting} className="gap-2">
                <ExternalLink className="w-4 h-4" />
                Join Meeting
              </Button>
              <Button variant="outline" onClick={handleCopyLink} className="gap-2">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/60 font-mono break-all max-w-md">
              {joinUrl}
            </p>
          </div>
        ) : (
          /* Jitsi: embeddable via iframe */
          <iframe
            src={jitsiUrl}
            className="w-full h-full border-0"
            allow="camera; microphone; display-capture; autoplay; clipboard-write"
            allowFullScreen
          />
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 border-t border-border bg-card/80 backdrop-blur-sm safe-area-bottom">
        {!isRingCentral && (
          <>
            <Button
              variant={isMuted ? "destructive" : "outline"}
              size="sm"
              className="h-9 w-9 md:h-10 md:w-10 rounded-full p-0"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              variant={isVideoOff ? "destructive" : "outline"}
              size="sm"
              className="h-9 w-9 md:h-10 md:w-10 rounded-full p-0"
              onClick={() => setIsVideoOff(!isVideoOff)}
            >
              {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            </Button>
          </>
        )}

        {/* Leave / End buttons */}
        <Button
          variant="destructive"
          size="sm"
          className="h-9 md:h-10 px-3 md:px-4 rounded-full gap-1.5"
          onClick={() => {
            if (isCreator) onEnd();
            else onLeave();
          }}
        >
          <PhoneOff className="w-4 h-4" />
          <span className="hidden sm:inline">{isCreator ? "End Meeting" : "Leave"}</span>
        </Button>
      </div>
    </div>
  );
}