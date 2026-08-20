import { BarChart3, Search, FileText, CheckSquare, MessageSquare, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SeoSection } from "@/pages/SeoModule";

const items: { id: SeoSection; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Dashboard", icon: BarChart3 },
  { id: "keywords", label: "Keywords", icon: Search },
  { id: "pages", label: "Pages", icon: FileText },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "links", label: "Links", icon: Link2 },
  { id: "copilot", label: "Copilot", icon: MessageSquare },
];

interface Props {
  active: SeoSection;
  onNavigate: (s: SeoSection) => void;
}

export function SeoSidebar({ active, onNavigate }: Props) {
  return (
    <aside className="w-48 shrink-0 border-r border-border bg-card flex flex-col py-4 px-2 gap-1">
      <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase px-2 mb-3">
        SEO Module
      </h2>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
            active === item.id
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <item.icon className="w-4 h-4" />
          {item.label}
        </button>
      ))}
    </aside>
  );
}
