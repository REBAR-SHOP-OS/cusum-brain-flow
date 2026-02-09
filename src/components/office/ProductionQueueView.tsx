import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCutPlans } from "@/hooks/useCutPlans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Pencil, Settings, RotateCcw, Barcode, Star, CheckCircle2, Trash2, 
  Clock, Package, Activity, FolderOpen, FileText, ChevronRight, ChevronDown
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProjects } from "@/hooks/useProjects";
import { useBarlists } from "@/hooks/useBarlists";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ProductionQueueView() {
  const { plans, loading, deletePlan } = useCutPlans();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { companyId } = useCompanyId();
  const { projects } = useProjects(companyId ?? undefined);
  const { barlists } = useBarlists(companyId ?? undefined);

  const activePlans = plans.filter(p => ["draft", "ready", "running", "queued"].includes(p.status));

  // Group: project → barlists → plans
  // Build a tree: projects containing barlists containing plans
  const tree = buildProjectTree(projects, barlists, plans);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black italic text-foreground uppercase">Production Queue</h1>
          <p className="text-sm text-muted-foreground">Projects → Barlists → Manifests</p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/30 gap-1">
          <Activity className="w-3 h-3" />
          {activePlans.length} Active Jobs
        </Badge>
      </div>

      {/* Project Folders */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading queue...</p>
      ) : tree.length === 0 ? (
        <p className="text-sm text-muted-foreground">No manifests in queue.</p>
      ) : (
        <div className="space-y-3">
          {tree.map(node => (
            <ProjectFolder
              key={node.projectId || "unassigned"}
              node={node}
              onDeletePlan={deletePlan}
              onEditPlan={(id) => navigate(`/cutter-planning?planId=${id}`)}
            />
          ))}
        </div>
      )}

      {/* Policy Banner */}
      <div className="rounded-xl border border-border bg-card/50 p-5 space-y-2">
        <div className="flex items-center gap-2 text-xs tracking-widest text-muted-foreground uppercase">
          <Clock className="w-3.5 h-3.5" />
          Production Policy
        </div>
        <h3 className="text-sm font-bold text-foreground">Queue Hierarchy Rules</h3>
        <p className="text-xs text-muted-foreground">
          Supervisor PIN is required for <span className="text-destructive font-medium">DELETE</span> and <span className="text-green-500 font-medium">COMPLETE</span> actions.
        </p>
      </div>
    </div>
  );
}

// --- Tree building ---

interface PlanNode {
  id: string;
  name: string;
  status: string;
  project_name: string | null;
}

interface BarlistNode {
  barlistId: string;
  barlistName: string;
  revisionNo: number;
  plans: PlanNode[];
}

interface ProjectNode {
  projectId: string | null;
  projectName: string;
  barlists: BarlistNode[];
  // Plans not linked to any barlist
  loosePlans: PlanNode[];
}

function buildProjectTree(
  projects: Array<{ id: string; name: string }>,
  barlists: Array<{ id: string; name: string; revision_no: number; project_id: string }>,
  plans: PlanNode[]
): ProjectNode[] {
  const projectMap = new Map(projects.map(p => [p.id, p.name]));
  const barlistsByProject = new Map<string, typeof barlists>();
  
  barlists.forEach(b => {
    const pid = b.project_id || "__none__";
    if (!barlistsByProject.has(pid)) barlistsByProject.set(pid, []);
    barlistsByProject.get(pid)!.push(b);
  });

  // Match plans to barlists by name similarity
  const usedPlanIds = new Set<string>();
  const barlistPlanMap = new Map<string, PlanNode[]>();

  barlists.forEach(b => {
    const matched = plans.filter(p => {
      if (usedPlanIds.has(p.id)) return false;
      // Match by name or project_name
      return p.name === b.name || p.project_name === b.name;
    });
    matched.forEach(p => usedPlanIds.add(p.id));
    if (matched.length > 0) barlistPlanMap.set(b.id, matched);
  });

  const result: ProjectNode[] = [];

  // Build project nodes
  const projectIds = new Set([
    ...barlists.map(b => b.project_id).filter(Boolean),
    ...projects.map(p => p.id),
  ]);

  projectIds.forEach(pid => {
    const pBarlists = barlistsByProject.get(pid) || [];
    const barlistNodes: BarlistNode[] = pBarlists.map(b => ({
      barlistId: b.id,
      barlistName: b.name,
      revisionNo: b.revision_no,
      plans: barlistPlanMap.get(b.id) || [],
    }));

    // Only include projects that have barlists or plans
    if (barlistNodes.length > 0 || barlistNodes.some(bn => bn.plans.length > 0)) {
      result.push({
        projectId: pid,
        projectName: projectMap.get(pid) || "Unknown Project",
        barlists: barlistNodes,
        loosePlans: [],
      });
    }
  });

  // Unmatched plans
  const unmatchedPlans = plans.filter(p => !usedPlanIds.has(p.id));
  if (unmatchedPlans.length > 0) {
    result.push({
      projectId: null,
      projectName: "Unassigned",
      barlists: [],
      loosePlans: unmatchedPlans,
    });
  }

  return result;
}

// --- Components ---

function ProjectFolder({ node, onDeletePlan, onEditPlan }: {
  node: ProjectNode;
  onDeletePlan: (id: string) => void;
  onEditPlan: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const totalPlans = node.barlists.reduce((s, b) => s + b.plans.length, 0) + node.loosePlans.length;
  const totalBarlists = node.barlists.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors text-left">
          {open ? <ChevronDown className="w-4 h-4 text-primary shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
          <FolderOpen className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">{node.projectName}</h2>
            <p className="text-[10px] text-muted-foreground">
              {totalBarlists} barlist{totalBarlists !== 1 ? "s" : ""} · {totalPlans} manifest{totalPlans !== 1 ? "s" : ""}
            </p>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 mt-1 space-y-1 border-l-2 border-primary/10 pl-4">
          {node.barlists.map(bl => (
            <BarlistFolder key={bl.barlistId} barlist={bl} onDeletePlan={onDeletePlan} onEditPlan={onEditPlan} />
          ))}
          {node.loosePlans.map(plan => (
            <QueueCard key={plan.id} plan={plan} onDelete={() => onDeletePlan(plan.id)} onEdit={() => onEditPlan(plan.id)} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function BarlistFolder({ barlist, onDeletePlan, onEditPlan }: {
  barlist: BarlistNode;
  onDeletePlan: (id: string) => void;
  onEditPlan: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted/30 transition-colors text-left">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground truncate">{barlist.barlistName}</span>
          <Badge variant="outline" className="text-[9px] ml-1 shrink-0">Rev {barlist.revisionNo}</Badge>
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{barlist.plans.length} manifest{barlist.plans.length !== 1 ? "s" : ""}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 mt-0.5 space-y-1">
          {barlist.plans.length === 0 ? (
            <p className="text-[10px] text-muted-foreground py-1 pl-2">No manifests linked</p>
          ) : (
            barlist.plans.map(plan => (
              <QueueCard key={plan.id} plan={plan} onDelete={() => onDeletePlan(plan.id)} onEdit={() => onEditPlan(plan.id)} />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function QueueCard({ plan, onDelete, onEdit }: {
  plan: PlanNode;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const statusMap: Record<string, { label: string; color: string }> = {
    draft: { label: "DRAFT", color: "bg-muted text-muted-foreground" },
    ready: { label: "READY", color: "bg-yellow-500/20 text-yellow-500" },
    queued: { label: "QUEUED", color: "bg-blue-500/20 text-blue-500" },
    in_progress: { label: "ACTIVE", color: "bg-green-500/20 text-green-500" },
    running: { label: "RUNNING", color: "bg-green-500/20 text-green-500" },
  };

  const st = statusMap[plan.status] || statusMap.draft;

  return (
    <>
      <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-muted/20 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${plan.status === "in_progress" || plan.status === "running" ? "bg-green-500" : "bg-muted-foreground/30"}`} />
          <Badge className={`${st.color} text-[10px] tracking-wider border-0`}>{st.label}</Badge>
          <span className="text-xs font-medium text-foreground">{plan.name}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={onEdit}>
            <Pencil className="w-3 h-3" /> Edit
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive/60 hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{plan.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this manifest and all its items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
