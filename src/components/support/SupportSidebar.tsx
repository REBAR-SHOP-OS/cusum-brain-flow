import { ArrowUpRight, BookOpen, Inbox, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupportSection } from "@/pages/SupportInbox";

interface Props {
  active: SupportSection;
  onNavigate: (s: SupportSection) => void;
}

const items: {
  id: SupportSection;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  { id: "inbox", label: "Inbox", description: "Live chat queue, AI-assisted replies, and visitor context.", icon: Inbox },
  { id: "knowledge-base", label: "Knowledge Base", description: "Published answers, internal drafts, and AI grounding.", icon: BookOpen },
  { id: "settings", label: "Widget Settings", description: "Branding, embed controls, and website automation.", icon: Settings },
];

export function SupportSidebar({ active, onNavigate }: Props) {
  return (
    <aside className="w-[290px] shrink-0 border-r border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="flex h-full flex-col gap-6 p-4">
        <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/12 via-background to-background p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
                Support Hub
              </p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                Command center
              </h2>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Modern support for the ERP team with AI drafting, live visitor context, and website widget control in one place.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" />
            Ready for live conversations
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Workspace
          </p>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "group flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all",
              active === item.id
                ? "border-primary/20 bg-primary/10 text-foreground shadow-sm"
                : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors",
                active === item.id
                  ? "border-primary/20 bg-primary text-primary-foreground"
                  : "border-border/60 bg-background text-muted-foreground group-hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-medium", active === item.id ? "text-foreground" : "text-foreground/90")}>
                  {item.label}
                </span>
                {active === item.id && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {item.description}
              </p>
            </div>
            <ArrowUpRight
              className={cn(
                "mt-1 h-4 w-4 shrink-0 transition-transform",
                active === item.id ? "translate-x-0 text-primary" : "text-muted-foreground/50 group-hover:translate-x-0.5"
              )}
            />
          </button>
        ))}
        </nav>

        <div className="mt-auto rounded-3xl border border-border/60 bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            AI-assisted workflow
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Use knowledge base grounding, suggested replies, and live widget controls to answer faster without leaving the workspace.
          </p>
        </div>
      </div>
    </aside>
  );
}
