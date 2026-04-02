import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineDatePickerProps {
  onDateSelect: (date: Date) => void;
}

export function InlineDatePicker({ onDateSelect }: InlineDatePickerProps) {
  const [selected, setSelected] = useState<Date | undefined>();
  const [confirmed, setConfirmed] = useState(false);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      setSelected(date);
      setConfirmed(true);
      onDateSelect(date);
    }
  };

  if (confirmed && selected) {
    return (
      <div className="flex gap-3 items-start animate-fade-in px-4">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <CalendarIcon className="w-4 h-4 text-primary" />
        </div>
        <div className="bg-secondary/50 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="font-medium">{format(selected, "PPP")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start animate-fade-in px-4">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <CalendarIcon className="w-4 h-4 text-primary" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-2 shadow-sm">
        <p className="text-xs text-muted-foreground px-2 pt-1 pb-2">Select your target date:</p>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          className={cn("p-3 pointer-events-auto")}
          initialFocus
        />
      </div>
    </div>
  );
}
