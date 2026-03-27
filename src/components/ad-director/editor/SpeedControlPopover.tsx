import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SpeedControlPopoverProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  children: React.ReactNode;
}

const SPEED_OPTIONS = [
  { value: 0.5, label: "0.5×" },
  { value: 0.75, label: "0.75×" },
  { value: 1, label: "1× Normal" },
  { value: 1.25, label: "1.25×" },
  { value: 1.5, label: "1.5×" },
  { value: 2, label: "2×" },
];

export function SpeedControlPopover({ speed, onSpeedChange, children }: SpeedControlPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent align="center" side="top" className="w-40 p-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">
          سرعت پخش
        </p>
        {SPEED_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={speed === option.value ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "w-full justify-start gap-2 text-xs h-8",
              speed === option.value && "font-bold"
            )}
            onClick={() => onSpeedChange(option.value)}
          >
            <Gauge className="w-3.5 h-3.5" />
            {option.label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
