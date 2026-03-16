import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home, Image, Sparkles, Type, Camera, LayoutGrid, History,
  ChevronLeft, ChevronRight, Film, FileImage, Wand2,
  Music, SlidersHorizontal, Layers, Palette, Shapes,
} from "lucide-react";
import { useAdProjectHistory, type AdProjectRow } from "@/hooks/useAdProjectHistory";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface AdDirectorSidebarProps {
  onLoadProject?: (project: AdProjectRow) => void;
  onNavigateTab?: (tab: string | null) => void;
  activeTab?: string | null;
}

const PLUGINS = [
  { icon: Type, label: "Text to clip", tab: "text" },
  { icon: FileImage, label: "Stock Images", tab: "stock-images" },
  { icon: Film, label: "Stock Video", tab: "stock-video" },
  { icon: LayoutGrid, label: "Templates", tab: "templates" },
  { icon: Shapes, label: "Graphics", tab: "graphics" },
];

const TOOLS = [
  { icon: Music, label: "Audio mixer", tab: "music" },
  { icon: SlidersHorizontal, label: "Filters & effects", tab: "settings" },
  { icon: Layers, label: "Transitions", tab: "transitions" },
  { icon: Palette, label: "Brand kit", tab: "brand-kit" },
];

export function AdDirectorSidebar({ onLoadProject, onNavigateTab, activeTab }: AdDirectorSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { projects } = useAdProjectHistory();
  const recentProjects = (projects.data ?? []).slice(0, 5);

  return (
    <div
      className={cn(
        "h-full bg-card/60 border-r border-border/20 flex flex-col transition-all duration-200 shrink-0",
        collapsed ? "w-12" : "w-52"
      )}
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-end p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-1">
        {/* Home */}
        <SidebarItem icon={Home} label="Home" collapsed={collapsed} onClick={() => navigate("/ad-director")} />

        {/* Media Library */}
        <SidebarItem icon={Image} label="My Media" collapsed={collapsed} active={activeTab === "media"} onClick={() => onNavigateTab?.("media")} />

        {/* Record */}
        <SidebarItem icon={Camera} label="Record" collapsed={collapsed} active={activeTab === "record"} onClick={() => onNavigateTab?.("record")} />

        {/* Generative Picks */}
        <SidebarItem icon={Sparkles} label="AI Generate" collapsed={collapsed} onClick={() => navigate("/video-studio")} />

        {/* Plugins */}
        {!collapsed && (
          <div className="pt-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2">Plugins</span>
          </div>
        )}
        {collapsed && <div className="border-t border-border/20 my-2" />}
        {PLUGINS.map((p) => (
          <SidebarItem
            key={p.label}
            icon={p.icon}
            label={p.label}
            collapsed={collapsed}
            active={activeTab === p.tab}
            onClick={() => onNavigateTab?.(p.tab)}
          />
        ))}

        {/* Tools */}
        {!collapsed && (
          <div className="pt-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2">Tools</span>
          </div>
        )}
        {collapsed && <div className="border-t border-border/20 my-2" />}
        {TOOLS.map((t) => (
          <SidebarItem
            key={t.label}
            icon={t.icon}
            label={t.label}
            collapsed={collapsed}
            active={activeTab === t.tab}
            onClick={() => onNavigateTab?.(t.tab)}
          />
        ))}

        {/* History */}
        {!collapsed && (
          <div className="pt-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2">History</span>
          </div>
        )}
        {collapsed && <div className="border-t border-border/20 my-2" />}

        {!collapsed && recentProjects.length > 0 ? (
          <div className="space-y-0.5">
            {recentProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => onLoadProject?.(p)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-muted/30 transition-colors group"
              >
                <Film className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] truncate text-muted-foreground group-hover:text-foreground transition-colors">
                    {p.name}
                  </div>
                </div>
                <Badge variant="secondary" className="text-[8px] px-1 h-4 shrink-0">
                  {p.status}
                </Badge>
              </button>
            ))}
          </div>
        ) : !collapsed ? (
          <div className="px-2 py-2 text-[10px] text-muted-foreground/50">No projects yet</div>
        ) : (
          <SidebarItem icon={History} label="History" collapsed={collapsed} onClick={() => {}} />
        )}
      </nav>

      {/* Version badge */}
      {!collapsed && (
        <div className="p-3 border-t border-border/20">
          <span className="text-[9px] text-muted-foreground/40">AI Video Director v2</span>
        </div>
      )}
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  collapsed,
  onClick,
  active,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
        disabled && "opacity-40 cursor-not-allowed",
        collapsed && "justify-center px-0"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="text-xs truncate">{label}</span>}
    </button>
  );
}
