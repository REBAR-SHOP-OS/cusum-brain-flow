import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, FolderOpen, Play, Pause, CheckCircle2, Cpu, ChevronRight } from "lucide-react";
import { CutPlan } from "@/hooks/useCutPlans";

interface MachineGroupSectionProps {
  machineName: string;
  runningPlans: CutPlan[];
  queuedPlans: CutPlan[];
  onUpdateStatus: (planId: string, status: string) => Promise<boolean>;
  onStatusChanged: (planName: string, action: string) => void;
  availableMachines?: { id: string; name: string }[];
  onAssignMachine?: (planId: string, machineId: string) => void;
}

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: "DRAFT", color: "bg-muted text-muted-foreground" },
  ready: { label: "READY", color: "bg-warning/20 text-warning" },
  queued: { label: "QUEUED", color: "bg-primary/20 text-primary" },
};

function groupByProject(plans: CutPlan[]): [string, CutPlan[]][] {
  const map = new Map<string, CutPlan[]>();
  for (const plan of plans) {
    const key = plan.project_name || plan.customer_name || "Unassigned";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(plan);
  }
  return [...map.entries()].sort((a, b) =>
    a[0] === "Unassigned" ? 1 : b[0] === "Unassigned" ? -1 : a[0].localeCompare(b[0])
  );
}

export function MachineGroupSection({
  machineName,
  runningPlans,
  queuedPlans,
  onUpdateStatus,
  onStatusChanged,
  availableMachines,
  onAssignMachine,
}: MachineGroupSectionProps) {
  const [open, setOpen] = useState(true);
  const totalJobs = runningPlans.length + queuedPlans.length;

  if (totalJobs === 0) return null;

  const runningGroups = groupByProject(runningPlans);
  const queuedGroups = groupByProject(queuedPlans);

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
            {runningGroups.map(([projectName, plans]) => (
              <ProjectFolder key={projectName} projectName={projectName} plans={plans} variant="running" onUpdateStatus={onUpdateStatus} onStatusChanged={onStatusChanged} availableMachines={availableMachines} onAssignMachine={onAssignMachine} />
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
            {queuedGroups.map(([projectName, plans]) => (
              <ProjectFolder key={projectName} projectName={projectName} plans={plans} variant="queued" onUpdateStatus={onUpdateStatus} onStatusChanged={onStatusChanged} availableMachines={availableMachines} onAssignMachine={onAssignMachine} />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProjectFolder({
  projectName,
  plans,
  variant,
  onUpdateStatus,
  onStatusChanged,
  availableMachines,
  onAssignMachine,
}: {
  projectName: string;
  plans: CutPlan[];
  variant: "running" | "queued";
  onUpdateStatus: (id: string, status: string) => Promise<boolean>;
  onStatusChanged: (name: string, action: string) => void;
  availableMachines?: { id: string; name: string }[];
  onAssignMachine?: (planId: string, machineId: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="ml-2">
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 px-1.5 rounded hover:bg-muted/30 transition-colors">
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground truncate flex-1 text-left">{projectName}</span>
        <Badge variant="outline" className="text-[9px] tracking-wider shrink-0 h-4 px-1.5">
          {plans.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-4 space-y-1 mt-1">
        {plans.map(plan => (
          <PlanRow key={plan.id} plan={plan} variant={variant} onUpdateStatus={onUpdateStatus} onStatusChanged={onStatusChanged} availableMachines={availableMachines} onAssignMachine={onAssignMachine} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function PlanRow({
  plan,
  variant,
  onUpdateStatus,
  onStatusChanged,
  availableMachines,
  onAssignMachine,
}: {
  plan: CutPlan;
  variant: "running" | "queued";
  onUpdateStatus: (id: string, status: string) => Promise<boolean>;
  onStatusChanged: (name: string, action: string) => void;
  availableMachines?: { id: string; name: string }[];
  onAssignMachine?: (planId: string, machineId: string) => void;
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
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {!plan.machine_id && availableMachines && onAssignMachine && (
          <Select onValueChange={(machineId) => onAssignMachine(plan.id, machineId)}>
            <SelectTrigger className="w-[130px] h-7 text-[10px] bg-card">
              <SelectValue placeholder="Assign machine" />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              {availableMachines.map(m => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
