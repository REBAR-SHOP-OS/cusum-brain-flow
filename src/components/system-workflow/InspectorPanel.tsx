import { ExternalLink, GitBranch, Layers, MoveRight, Server, Shield, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { WorkflowModuleDetail, WorkflowRegistry } from "@/types/workflowDiagram";
import { cn } from "@/lib/utils";
import { LayerDetails } from "@/components/system-workflow/LayerDetails";

function groupLabel(g: WorkflowModuleDetail["group"]) {
  switch (g) {
    case "user_interface":
      return "User / Interface";
    case "app_auth":
      return "App / Auth";
    case "core_data_api":
      return "Core / Data / API";
    case "automation_signals":
      return "Automation / Signals";
    case "external_integrations":
      return "External Partners";
    case "monitoring_health":
      return "Monitoring / Health";
    case "fix_center":
      return "Fix Center";
    default:
      return g;
  }
}

function statusBadgeVariant(s: WorkflowModuleDetail["healthStatus"]) {
  switch (s) {
    case "healthy":
      return "secondary" as const;
    case "warning":
      return "outline" as const;
    case "error":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function statusLabel(s: WorkflowModuleDetail["healthStatus"]) {
  switch (s) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Warning";
    case "error":
      return "Error";
    default:
      return "Unknown";
  }
}

export function InspectorPanel(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: WorkflowModuleDetail | null;
  onOpenInternal: () => void;
}) {
  const { open, onOpenChange, module, onOpenInternal } = props;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-[92vw] max-w-lg border-white/10 bg-slate-950/70 p-0 text-white shadow-2xl backdrop-blur-xl",
          "sm:w-[420px] sm:max-w-lg",
        )}
      >
        <SheetHeader className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <SheetTitle className="truncate text-base text-white">{module?.name ?? "Inspector"}</SheetTitle>
              <SheetDescription className="mt-1 text-xs text-white/60">
                {module ? `${groupLabel(module.group)} · ${module.kind}` : "Select a module to inspect"}
              </SheetDescription>
            </div>
            {module && (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge variant={statusBadgeVariant(module.healthStatus)} className="border-white/10 bg-white/5 text-white">
                  {statusLabel(module.healthStatus)}
                </Badge>
                {!!module.errorCount && (
                  <Badge variant="destructive" className="bg-rose-600/90">
                    {module.errorCount} errors
                  </Badge>
                )}
                {!!module.warningCount && (
                  <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 text-amber-200">
                    {module.warningCount} warnings
                  </Badge>
                )}
              </div>
            )}
          </div>

          {module?.childGraphId && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5">
              <div className="flex items-center gap-2 text-xs text-white/70">
                <Layers className="h-4 w-4" />
                Internal map available
              </div>
              <Button
                size="sm"
                className="h-8 bg-white/10 text-white hover:bg-white/15"
                onClick={onOpenInternal}
              >
                Open map
                <MoveRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-9rem)] px-5 py-4">
          {module ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <Server className="h-4 w-4 text-sky-200" />
                  <span className="truncate">Last update</span>
                </div>
                <div className="col-span-2 truncate text-xs text-white/90">{module.lastUpdatedAt}</div>

                <div className="flex items-center gap-2 text-xs text-white/70">
                  <GitBranch className="h-4 w-4 text-violet-200" />
                  <span className="truncate">Dependencies</span>
                </div>
                <div className="col-span-2 truncate text-xs text-white/90">
                  {module.dependencies.length ? module.dependencies.join(", ") : "—"}
                </div>

                <div className="flex items-center gap-2 text-xs text-white/70">
                  <Shield className="h-4 w-4 text-emerald-200" />
                  <span className="truncate">Status</span>
                </div>
                <div className="col-span-2 truncate text-xs text-white/90">{module.logsSummary}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!!module.apis.length && (
                  <Badge variant="outline" className="border-sky-400/30 bg-sky-400/10 text-sky-200">
                    <ExternalLink className="mr-1 h-3 w-3" />
                    APIs
                  </Badge>
                )}
                {!!module.webhooks.length && (
                  <Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
                    <Webhook className="mr-1 h-3 w-3" />
                    Webhooks
                  </Badge>
                )}
              </div>

              <LayerDetails module={module} />
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Click any node to open the inspector. Double-click a node or use “Open map” to drill into sublayers.
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

