import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Video, Mic, MonitorUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StartMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelName: string;
  onStart: (title: string, type: "video" | "audio" | "screen_share") => Promise<void>;
  isStarting: boolean;
}

const meetingTypes = [
  { type: "video" as const, icon: Video, label: "Video Call", desc: "Camera + mic + screen share" },
  { type: "audio" as const, icon: Mic, label: "Audio Call", desc: "Voice only, no camera" },
  { type: "screen_share" as const, icon: MonitorUp, label: "Screen Share", desc: "Share screen with audio" },
];

export function StartMeetingDialog({
  open,
  onOpenChange,
  channelName,
  onStart,
  isStarting,
}: StartMeetingDialogProps) {
  const [title, setTitle] = useState("");
  const [selectedType, setSelectedType] = useState<"video" | "audio" | "screen_share">("video");

  const handleStart = async () => {
    await onStart(title.trim() || `${channelName} Meeting`, selectedType);
    setTitle("");
    setSelectedType("video");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Video className="w-4 h-4 text-primary" />
            </div>
            Start Meeting
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Meeting Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Meeting Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${channelName} Meeting`}
              className="text-sm"
              autoFocus
            />
          </div>

          {/* Meeting Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Meeting Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {meetingTypes.map(({ type, icon: Icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-center",
                    selectedType === type
                      ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                      : "border-border hover:border-primary/30 hover:bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    selectedType === type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isStarting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleStart}
            disabled={isStarting}
            className="gap-1.5"
          >
            {isStarting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Video className="w-3.5 h-3.5" />
            )}
            Start Meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
