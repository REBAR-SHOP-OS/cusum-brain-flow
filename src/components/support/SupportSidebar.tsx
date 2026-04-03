import { Inbox, Settings, BookOpen, Sparkles, ShieldCheck, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupportSection } from "@/pages/SupportInbox";

interface Props {
  active: SupportSection;
  onNavigate: (s: SupportSection) => void;
}

const items: { id: SupportSection; label: string; icon: React.ElementType }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { id: "settings", label: "Widget Settings", icon: Settings },
];

export function SupportSidebar({ active, onNavigate }: Props) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/70 bg-gradient-to-b from-background via-background to-muted/30 md:flex md:flex-col">
      <div className="border-b border-border/70 px-5 py-5">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Modern support stack
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Support OS</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Realtime inbox, AI-assisted replies, and widget control in one workspace.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 py-4">
        <div className="rounded-2xl border border-border/60 bg-card/70 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Workflow className="h-3.5 w-3.5 text-primary" />
            Omnichannel
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Triage faster with one queue.</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/70 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Always on
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Presence, notes, and routing.</p>
        </div>
      </div>

      <div className="px-4 pb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        Workspace
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "group flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition-all",
              active === item.id
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:bg-card hover:text-foreground"
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors",
                active === item.id
                  ? "border-primary-foreground/20 bg-primary-foreground/10"
                  : "border-border/60 bg-background/80 group-hover:border-primary/20 group-hover:bg-primary/5"
              )}
            >
              <item.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="font-medium">{item.label}</div>
              <div
                className={cn(
                  "truncate text-xs",
                  active === item.id ? "text-primary-foreground/70" : "text-muted-foreground"
                )}
              >
                {item.id === "inbox" && "Live conversations and routing"}
                {item.id === "knowledge-base" && "Self-serve answers and docs"}
                {item.id === "settings" && "Widget branding and behavior"}
              </div>
            </div>
          </button>
        ))}
      </nav>

      <div className="mt-auto p-4">
        <div className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-sm">
          <p className="text-sm font-medium text-foreground">Upgrade the support experience</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Combine fast human replies, AI drafting, and visitor context without switching tools.
          </p>
        </div>
      </div>
    </aside>
  );
}
