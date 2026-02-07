import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  ListChecks,
  Mail,
  Search,
  Calculator,
  CalendarDays,
  Users,
  TrendingUp,
  Package,
  Truck,
} from "lucide-react";

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  value: string;
}

const slashCommands: SlashCommand[] = [
  { id: "summary", label: "Summary", description: "Summarize recent activity", icon: FileText, value: "/summary " },
  { id: "tasks", label: "Tasks", description: "List my open tasks", icon: ListChecks, value: "/tasks " },
  { id: "email", label: "Draft email", description: "Draft an email to a contact", icon: Mail, value: "/email " },
  { id: "search", label: "Search", description: "Search across data", icon: Search, value: "/search " },
  { id: "quote", label: "Quote", description: "Generate a new quote", icon: Calculator, value: "/quote " },
  { id: "schedule", label: "Schedule", description: "Check or set schedule", icon: CalendarDays, value: "/schedule " },
  { id: "customer", label: "Customer", description: "Look up customer info", icon: Users, value: "/customer " },
  { id: "pipeline", label: "Pipeline", description: "View sales pipeline status", icon: TrendingUp, value: "/pipeline " },
  { id: "inventory", label: "Inventory", description: "Check inventory levels", icon: Package, value: "/inventory " },
  { id: "delivery", label: "Delivery", description: "Track deliveries", icon: Truck, value: "/delivery " },
];

interface SlashCommandMenuProps {
  isOpen: boolean;
  filter: string;
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ isOpen, filter, selectedIndex, onSelect, onClose }: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = slashCommands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(filter.toLowerCase()) ||
      cmd.description.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 mb-2 w-[300px] bg-popover border border-border rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">Commands</span>
      </div>
      <div className="max-h-[240px] overflow-y-auto py-1">
        {filtered.map((cmd, i) => (
          <button
            key={cmd.id}
            type="button"
            onClick={() => onSelect(cmd)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
              i === selectedIndex % filtered.length
                ? "bg-primary/10 text-foreground"
                : "hover:bg-muted/50 text-foreground"
            )}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <cmd.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">/{cmd.label.toLowerCase()}</div>
              <div className="text-xs text-muted-foreground truncate">{cmd.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export { slashCommands };
