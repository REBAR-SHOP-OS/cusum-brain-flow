import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Boxes, ExternalLink, FileCode, Webhook, Clock, MousePointerClick } from "lucide-react";
import type { EdgeFunctionInfo } from "@/lib/edgeFunctionsRegistry";
import { EDGE_FUNCTIONS } from "@/lib/edgeFunctionsRegistry";
import { getCallersFor } from "@/lib/edgeFunctionConnections";

const accentText: Record<EdgeFunctionInfo["accent"], string> = {
  cyan: "text-cyan-400",
  emerald: "text-emerald-400",
  orange: "text-orange-400",
  violet: "text-violet-400",
  blue: "text-blue-400",
  rose: "text-rose-400",
  amber: "text-amber-400",
};

const accentBorder: Record<EdgeFunctionInfo["accent"], string> = {
  cyan: "border-cyan-400/40",
  emerald: "border-emerald-400/40",
  orange: "border-orange-400/40",
  violet: "border-violet-400/40",
  blue: "border-blue-400/40",
  rose: "border-rose-400/40",
  amber: "border-amber-400/40",
};

const SUPABASE_LOGS_URL = "https://supabase.com/dashboard/project/uavzziigfnqpfdkczbdo/functions";

const triggerIcon = {
  manual: MousePointerClick,
  cron: Clock,
  webhook: Webhook,
};

interface Props {
  fn: EdgeFunctionInfo | null;
  onOpenChange: (open: boolean) => void;
  onSelect: (fn: EdgeFunctionInfo) => void;
}

export function EdgeFunctionDetailDialog({ fn, onOpenChange, onSelect }: Props) {
  if (!fn) return null;

  const callers = getCallersFor(fn.name);
  const related = EDGE_FUNCTIONS.filter((f) => f.category === fn.category && f.name !== fn.name);

  return (
    <Dialog open={!!fn} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border/80 bg-background/95 backdrop-blur-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Boxes className={`h-5 w-5 ${accentText[fn.accent]}`} />
            <code className="font-mono">{fn.name}</code>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-3 space-y-5">
              {/* Category + triggers */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`${accentText[fn.accent]} ${accentBorder[fn.accent]}`}>
                  {fn.category}
                </Badge>
                {fn.triggers.map((t) => {
                  const Icon = triggerIcon[t];
                  return (
                    <Badge key={t} variant="secondary" className="gap-1 capitalize">
                      <Icon className="h-3 w-3" />
                      {t}
                    </Badge>
                  );
                })}
              </div>

              {/* Frontend callers */}
              <section>
                <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Frontend callers ({callers.length})
                </h4>
                {callers.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No direct frontend callers detected. Likely invoked via cron, webhook, or another edge function.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {callers.map((c) => (
                      <li
                        key={c}
                        className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-2.5 py-1.5 text-xs font-mono"
                      >
                        <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{c}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Related */}
              {related.length > 0 && (
                <section>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Related ({related.length}) · {fn.category}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {related.slice(0, 24).map((r) => (
                      <button
                        key={r.name}
                        onClick={() => onSelect(r)}
                        className={`rounded-md border px-2 py-1 text-[11px] font-mono transition-colors hover:bg-muted/50 ${accentBorder[r.accent]} ${accentText[r.accent]}`}
                      >
                        {r.name}
                      </button>
                    ))}
                    {related.length > 24 && (
                      <span className="self-center text-[11px] text-muted-foreground">+{related.length - 24} more</span>
                    )}
                  </div>
                </section>
              )}

              {/* Logs */}
              <div className="border-t border-border/40 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-2"
                >
                  <a
                    href={`${SUPABASE_LOGS_URL}/${fn.name}/logs`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View logs
                  </a>
                </Button>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
