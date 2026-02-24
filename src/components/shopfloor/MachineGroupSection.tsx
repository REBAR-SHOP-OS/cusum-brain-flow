import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FolderOpen, Layers, FileText, Play, Pause, CheckCircle2, Cpu } from "lucide-react";
import { CutPlan } from "@/hooks/useCutPlans";

interface MachineGroupSectionProps {
  machineName: string;
  runningPlans: CutPlan[];
  queuedPlans: CutPlan[];
  onUpdateStatus: (planId: string, status: string) => Promise<boolean>;
  onStatusChanged: (planName: string, action: string) => void;
}

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: "DRAFT", color: "bg-muted text-muted-foreground" },
  ready: { label: "READY", color: "bg-warning/20 text-warning" },
  queued: { label: "QUEUED", color: "bg-primary/20 text-primary" },
};

export function MachineGroupSection({
  machineName,
  runningPlans,
  queuedPlans,
  onUpdateStatus,
  onStatusChanged,
}: MachineGroupSectionProps) {
  const [open, setOpen] = useState(true);
  const totalJobs = runningPlans.length + queuedPlans.length;

  if (totalJobs === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border rounded-lg bg-card">
      <CollapsibleTrigger className="flex items-center gap-3 w-full p-3 hover:bg-muted/30 transition-colors rounded-t-lg">
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
        <Cpu className="w-4 h-4 text-primary" />
        <span className="text-sm font-black italic tracking-wide uppercase text-foreground flex-1 text-left truncate">
          {machineName}
        </span>
        <Badge variant="outline" className="text-[10px] tracking-wider shrink-0">
          {totalJobs} {totalJobs === 1 ? "JOB" : "JOBS"}
        </Badge>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-3 pb-3 space-y-4">
        {/* Running / Live */}
        {runningPlans.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 pt-1">
              <div className="w-5 h-5 rounded bg-success/20 flex items-center justify-center text-[9px] font-bold text-success">
                {runningPlans.length}
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-success">Live</span>
            </div>
            {runningPlans.map(plan => (
              <PlanRow
                key={plan.id}
                plan={plan}
                variant="running"
                onUpdateStatus={onUpdateStatus}
                onStatusChanged={onStatusChanged}
              />
            ))}
          </div>
        )}

        {/* Queued */}
        {queuedPlans.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 pt-1">
              <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                {queuedPlans.length}
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Queued</span>
            </div>
            {queuedPlans.map(plan => (
              <PlanRow
                key={plan.id}
                plan={plan}
                variant="queued"
                onUpdateStatus={onUpdateStatus}
                onStatusChanged={onStatusChanged}
              />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function PlanRow({
  plan,
  variant,
  onUpdateStatus,
  onStatusChanged,
}: {
  plan: CutPlan;
  variant: "running" | "queued";
  onUpdateStatus: (id: string, status: string) => Promise<boolean>;
  onStatusChanged: (name: string, action: string) => void;
}) {
  const isRunning = variant === "running";
  const st = isRunning
    ? { label: "ACTIVE", color: "bg-success/20 text-success" }
    : statusMap[plan.status] || statusMap.draft;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        isRunning ? "border-success/40 bg-card hover:bg-muted/30" : "border-border bg-card hover:bg-muted/30"
      }`}
    >
      <div className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? "bg-success animate-pulse" : "bg-muted-foreground/30"}`} />
      <Badge className={`${st.color} text-[10px] tracking-wider shrink-0`}>{st.label}</Badge>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-foreground truncate">{plan.name}</h3>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
          {plan.customer_name && (
            <span className="flex items-center gap-1 truncate">
              <FolderOpen className="w-3 h-3 shrink-0" />
              {plan.customer_name}
            </span>
          )}
          {plan.project_name && (
            <span className="flex items-center gap-1 truncate">
              <Layers className="w-3 h-3 shrink-0" />
              {plan.project_name}
            </span>
          )}
          {!plan.customer_name && !plan.project_name && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" /> Unassigned
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isRunning ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] gap-1 px-2.5 font-bold border-warning/40 text-warning hover:bg-warning/10"
              onClick={async () => {
                const ok = await onUpdateStatus(plan.id, "queued");
                if (ok) onStatusChanged(plan.name, "Paused");
              }}
            >
              <Pause className="w-3 h-3" /> Pause
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] gap-1 px-2.5 font-bold border-success/40 text-success hover:bg-success/10"
              onClick={async () => {
                const ok = await onUpdateStatus(plan.id, "completed");
                if (ok) onStatusChanged(plan.name, "Completed");
              }}
            >
              <CheckCircle2 className="w-3 h-3" /> Complete
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="h-7 text-[10px] gap-1 px-2.5 font-bold"
            onClick={async () => {
              const ok = await onUpdateStatus(plan.id, "running");
              if (ok) onStatusChanged(plan.name, "Started");
            }}
          >
            <Play className="w-3 h-3" /> Start
          </Button>
        )}
      </div>
    </div>
  );
}
