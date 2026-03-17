import { Layers, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PagePlan } from "@/data/appBuilderMockData";

interface Props {
  pages: PagePlan[];
}

export function AppBuilderPagePlan({ pages }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Layers className="w-5 h-5 text-orange-400" /> Pages ({pages.length})
      </h3>
      {pages.map((page) => (
        <div key={page.name} className="rounded-2xl border border-border bg-card p-5">
          <h4 className="font-semibold text-foreground mb-1">{page.name}</h4>
          <p className="text-sm text-muted-foreground mb-3">{page.purpose}</p>

          <div className="mb-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Components</span>
            <div className="flex flex-wrap gap-1.5">
              {page.components.map((c) => (
                <Badge key={c} className="bg-muted text-foreground text-xs border-0">{c}</Badge>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Actions</span>
            <div className="flex flex-wrap gap-1.5">
              {page.actions.map((a) => (
                <Badge key={a} className="bg-orange-500/10 text-orange-400 text-xs border-0">
                  <Zap className="w-3 h-3 mr-1" />{a}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
