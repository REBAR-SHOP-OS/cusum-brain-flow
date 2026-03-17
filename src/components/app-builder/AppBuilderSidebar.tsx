import { LayoutDashboard, FileText, Layers, Database, Eye, GitBranch, Download, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidebarSection } from "@/hooks/useAppBuilderProject";

const NAV_ITEMS: { id: SidebarSection; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "plan", label: "Plan", icon: FileText },
  { id: "pages", label: "Pages", icon: Layers },
  { id: "data-model", label: "Data Model", icon: Database },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "versions", label: "Versions", icon: GitBranch },
  { id: "export", label: "Export", icon: Download },
  { id: "settings", label: "Settings", icon: Settings },
];

interface Props {
  active: SidebarSection;
  onSelect: (s: SidebarSection) => void;
  projectName: string;
}

export function AppBuilderSidebar({ active, onSelect, projectName }: Props) {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card/50 flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground text-sm truncate">{projectName || "New App"}</h2>
        <span className="text-xs text-muted-foreground">App Builder</span>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              active === id
                ? "bg-orange-500/15 text-orange-400"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
