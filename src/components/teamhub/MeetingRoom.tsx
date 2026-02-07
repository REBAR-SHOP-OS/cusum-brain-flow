import { useState } from "react";
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

  // Build Jitsi URL with config
  const jitsiDomain = "meet.jit.si";
  const config = new URLSearchParams({
    "userInfo.displayName": displayName,
  });

  // Jitsi config via hash
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

  const jitsiUrl = `https://${jitsiDomain}/${meeting.room_code}#${configHash}`;

  const meetingTypeLabel = {
    video: "Video Call",
    audio: "Audio Call",
    screen_share: "Screen Share",
  }[meeting.meeting_type] || "Meeting";

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
              <span className="text-[10px] text-muted-foreground">LIVE</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
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

      {/* Jitsi Iframe */}
      <div className="flex-1 bg-black relative">
        <iframe
          src={jitsiUrl}
          className="w-full h-full border-0"
          allow="camera; microphone; display-capture; autoplay; clipboard-write"
          allowFullScreen
        />
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 border-t border-border bg-card/80 backdrop-blur-sm safe-area-bottom">
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
