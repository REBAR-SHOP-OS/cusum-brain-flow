import {
  LayoutDashboard, FileText, Layers, Database, Eye, GitBranch,
  Download, Settings, MessageSquare, Plug, Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidebarSection } from "@/hooks/useAppBuilderProject";
import { AppBuilderSettingsMenu } from "./AppBuilderSettingsMenu";

const PLAN_ITEMS: { id: SidebarSection; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "plan", label: "Plan", icon: FileText },
  { id: "pages", label: "Pages", icon: Layers },
  { id: "data-model", label: "Data Model", icon: Database },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "versions", label: "Versions", icon: GitBranch },
  { id: "export", label: "Export", icon: Download },
];

const MANAGE_ITEMS: { id: SidebarSection; label: string; icon: React.ElementType }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "connectors", label: "Connectors", icon: Plug },
  { id: "knowledge", label: "Knowledge", icon: Brain },
  { id: "settings", label: "Settings", icon: Settings },
];

interface Props {
  active: SidebarSection;
  onSelect: (s: SidebarSection) => void;
  projectName: string;
}

function NavItem({ id, label, icon: Icon, active, onSelect }: {
  id: SidebarSection; label: string; icon: React.ElementType;
  active: SidebarSection; onSelect: (s: SidebarSection) => void;
}) {
  return (
    <button
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
  );
}

export function AppBuilderSidebar({ active, onSelect, projectName }: Props) {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card/50 flex flex-col">
      {/* Header with settings menu */}
      <AppBuilderSettingsMenu projectName={projectName} onSelect={onSelect} />

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {/* Planning sections */}
        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Planning
        </p>
        {PLAN_ITEMS.map((item) => (
          <NavItem key={item.id} {...item} active={active} onSelect={onSelect} />
        ))}

        {/* Divider */}
        <div className="my-2 mx-3 h-px bg-border" />

        {/* Management sections */}
        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Workspace
        </p>
        {MANAGE_ITEMS.map((item) => (
          <NavItem key={item.id} {...item} active={active} onSelect={onSelect} />
        ))}
      </nav>
    </aside>
  );
}
