import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SpeedControlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

const SPEED_OPTIONS = [
  { value: 0.5, label: "0.5×" },
  { value: 0.75, label: "0.75×" },
  { value: 1, label: "1× Normal" },
  { value: 1.25, label: "1.25×" },
  { value: 1.5, label: "1.5×" },
  { value: 2, label: "2×" },
];

export function SpeedControlDialog({ open, onOpenChange, speed, onSpeedChange }: SpeedControlDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Gauge className="w-4 h-4" /> Video Playback Speed
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 py-2">
          {SPEED_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={speed === option.value ? "default" : "outline"}
              size="sm"
              className={cn("text-xs h-9", speed === option.value && "font-bold")}
              onClick={() => {
                onSpeedChange(option.value);
                onOpenChange(false);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
