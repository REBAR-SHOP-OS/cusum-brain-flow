import { Clock, Sun, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

interface SnoozePopoverProps {
  onSnooze: (until: Date) => void;
  children: React.ReactNode;
}

export function SnoozePopover({ onSnooze, children }: SnoozePopoverProps) {
  const { toast } = useToast();

  const snoozeOptions = [
    {
      label: "1 hour",
      icon: <Clock className="w-3.5 h-3.5" />,
      getDate: () => new Date(Date.now() + 60 * 60 * 1000),
    },
    {
      label: "3 hours",
      icon: <Clock className="w-3.5 h-3.5" />,
      getDate: () => new Date(Date.now() + 3 * 60 * 60 * 1000),
    },
    {
      label: "Tomorrow AM",
      icon: <Sun className="w-3.5 h-3.5" />,
      getDate: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
    {
      label: "Next Week",
      icon: <Calendar className="w-3.5 h-3.5" />,
      getDate: () => {
        const d = new Date();
        d.setDate(d.getDate() + (8 - d.getDay()) % 7 || 7);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
  ];

  const handleSnooze = (option: typeof snoozeOptions[0]) => {
    const until = option.getDate();
    onSnooze(until);
    toast({
      title: "Snoozed",
      description: `Email snoozed until ${until.toLocaleDateString()} ${until.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">Snooze until</p>
        {snoozeOptions.map((option) => (
          <Button
            key={option.label}
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs h-8"
            onClick={() => handleSnooze(option)}
          >
            {option.icon}
            {option.label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
