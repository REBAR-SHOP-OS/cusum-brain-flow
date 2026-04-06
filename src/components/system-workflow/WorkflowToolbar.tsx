import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { FlowEdgeKind } from "@/types/workflowDiagram";
import type { WorkflowFilterKey } from "@/lib/workflowDiagram/selectors";

const filterLabels: Record<WorkflowFilterKey, string> = {
  errors: "Errors",
  warnings: "Warnings",
  healthy: "Healthy",
  external: "External",
  internal: "Internal",
  data_flow: "Data flow",
  jobs: "Jobs",
};

const edgeLegend: { kind: FlowEdgeKind; label: string; className: string }[] = [
  { kind: "user_action", label: "User action", className: "bg-cyan-400/20 text-cyan-200 border-cyan-400/30" },
  { kind: "api", label: "API", className: "bg-violet-400/20 text-violet-200 border-violet-400/30" },
  { kind: "webhook", label: "Webhook", className: "bg-emerald-400/20 text-emerald-200 border-emerald-400/30" },
  { kind: "event", label: "Event", className: "bg-sky-400/20 text-sky-200 border-sky-400/30" },
  { kind: "data", label: "Data", className: "bg-blue-400/20 text-blue-200 border-blue-400/30" },
  { kind: "job", label: "Job", className: "bg-amber-400/20 text-amber-100 border-amber-400/30" },
];

export function WorkflowToolbar(props: {
  query: string;
  onQueryChange: (q: string) => void;
  filters: Set<WorkflowFilterKey>;
  onToggleFilter: (k: WorkflowFilterKey) => void;
}) {
  const activeCount = props.filters.size;
  return (
    <div className="pointer-events-auto flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/65 p-2 shadow-lg backdrop-blur-md sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
        <Input
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
          placeholder="Search modules, APIs, jobs, webhooks…"
          className="h-10 border-white/10 bg-slate-950/55 pl-9 text-white placeholder:text-white/40 focus-visible:ring-cyan-400/40"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-10 justify-between gap-2 border border-white/10 bg-slate-950/55 text-white hover:bg-white/10",
            )}
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-white/70" />
              Filters
            </span>
            {activeCount > 0 && (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-cyan-500/15 px-2 text-xs font-semibold text-cyan-200">
                {activeCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] border-white/10 bg-slate-950/90 p-3 text-white shadow-xl backdrop-blur-xl">
          <div className="text-xs font-semibold tracking-wide text-white/70">Filters</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(filterLabels) as WorkflowFilterKey[]).map((k) => {
              const on = props.filters.has(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => props.onToggleFilter(k)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                    on ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/80",
                    "hover:border-white/20 hover:bg-white/10",
                  )}
                >
                  {filterLabels[k]}
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-xs font-semibold tracking-wide text-white/70">Legend</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {edgeLegend.map((x) => (
              <Badge key={x.kind} variant="outline" className={cn("border", x.className)}>
                {x.label}
              </Badge>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

