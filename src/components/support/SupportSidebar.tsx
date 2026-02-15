import { Inbox, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupportSection } from "@/pages/SupportInbox";

interface Props {
  active: SupportSection;
  onNavigate: (s: SupportSection) => void;
}

const items: { id: SupportSection; label: string; icon: React.ElementType }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "settings", label: "Widget Settings", icon: Settings },
];

export function SupportSidebar({ active, onNavigate }: Props) {
  return (
    <aside className="w-48 shrink-0 border-r border-border bg-muted/30 flex flex-col py-3">
      <h2 className="px-4 mb-3 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        Support
      </h2>
      <nav className="flex flex-col gap-0.5 px-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
              active === item.id
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
