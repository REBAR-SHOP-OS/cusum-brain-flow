import React, { useState } from "react";
import { X, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface BriefingActionButtonsProps {
  itemText: string;
  onIgnore: (text: string, reason: string) => void;
  onReschedule: (text: string, date: Date) => void;
  onSummarize: (text: string) => void;
}

export function BriefingActionButtons({ itemText, onIgnore, onReschedule, onSummarize }: BriefingActionButtonsProps) {
  const [ignoreReason, setIgnoreReason] = useState("");
  const [ignoreOpen, setIgnoreOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  return (
    <span className="inline-flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
      {/* Ignore */}
      <Popover open={ignoreOpen} onOpenChange={setIgnoreOpen}>
        <PopoverTrigger asChild>
          <button
            title="Ignore"
            className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" side="top" align="start">
          <p className="text-xs font-medium mb-2">Reason to ignore</p>
          <Input
            value={ignoreReason}
            onChange={(e) => setIgnoreReason(e.target.value)}
            placeholder="e.g. Already handled"
            className="h-8 text-xs mb-2"
            onKeyDown={(e) => {
              if (e.key === "Enter" && ignoreReason.trim()) {
                onIgnore(itemText, ignoreReason.trim());
                setIgnoreReason("");
                setIgnoreOpen(false);
              }
            }}
          />
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            disabled={!ignoreReason.trim()}
            onClick={() => {
              onIgnore(itemText, ignoreReason.trim());
              setIgnoreReason("");
              setIgnoreOpen(false);
            }}
          >
            Dismiss
          </Button>
        </PopoverContent>
      </Popover>

      {/* Reschedule */}
      <Popover open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <PopoverTrigger asChild>
          <button
            title="Reschedule"
            className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
          >
            <Clock className="w-3 h-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" side="top" align="start">
          <Calendar
            mode="single"
            selected={undefined}
            onSelect={(date) => {
              if (date) {
                onReschedule(itemText, date);
                setRescheduleOpen(false);
              }
            }}
            disabled={(date) => date < new Date()}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      {/* Summarize */}
      <button
        title="Summarize"
        onClick={() => onSummarize(itemText)}
        className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
      >
        <Sparkles className="w-3 h-3" />
      </button>
    </span>
  );
}
