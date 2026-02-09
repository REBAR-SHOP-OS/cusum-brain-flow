import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCutPlans } from "@/hooks/useCutPlans";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Pencil, RotateCcw, CheckCircle2, Trash2, 
  Clock, Activity, FolderOpen, FileText, ChevronRight, ChevronDown, Users
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

// --- Types ---

interface PlanNode {
  id: string;
  name: string;
  status: string;
  project_name: string | null;
  project_id: string | null;
}

interface BarlistNode {
  barlistId: string;
  barlistName: string;
  fileName: string | null;
  revisionNo: number;
  plans: PlanNode[];
}

interface ProjectNode {
  projectId: string;
  projectName: string;
  barlists: BarlistNode[];
  loosePlans: PlanNode[];
}

interface CustomerNode {
  customerId: string | null;
  customerName: string;
  projects: ProjectNode[];
}

// --- Main Component ---

export function ProductionQueueView() {
  const { plans, loading, deletePlan } = useCutPlans();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { companyId } = useCompanyId();
  const { projects } = useProjects(companyId ?? undefined);
  const { barlists } = useBarlists();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDeleteBarlist = async (barlistId: string) => {
    // Delete work orders referencing this barlist first
    await supabase.from("work_orders").delete().eq("barlist_id", barlistId);
    await supabase.from("barlist_items").delete().eq("barlist_id", barlistId);
    const { error } = await supabase.from("barlists").delete().eq("id", barlistId);
    if (error) {
      toast({ title: "Error deleting barlist", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Barlist deleted" });
    queryClient.invalidateQueries({ queryKey: ["barlists"] });
  };

  const handleDeleteProject = async (projectId: string): Promise<boolean> => {
    // 1. Delete work orders referencing this project (and its barlists)
    await supabase.from("work_orders").delete().eq("project_id", projectId);
    
    // 2. Delete barlists and their items
    const projectBarlists = barlists.filter(b => b.project_id === projectId);
    for (const b of projectBarlists) {
      await supabase.from("work_orders").delete().eq("barlist_id", b.id);
      await supabase.from("barlist_items").delete().eq("barlist_id", b.id);
      await supabase.from("barlists").delete().eq("id", b.id);
    }
    
    // 3. Delete cut plan items (incl. clearance evidence) then cut plans
    const projectPlans = plans.filter(p => p.project_id === projectId);
    for (const p of projectPlans) {
      // Delete clearance evidence for each item
      const { data: items } = await supabase.from("cut_plan_items").select("id").eq("cut_plan_id", p.id);
      if (items && items.length > 0) {
        const itemIds = items.map(i => i.id);
        await supabase.from("clearance_evidence").delete().in("cut_plan_item_id", itemIds);
      }
      await supabase.from("cut_plan_items").delete().eq("cut_plan_id", p.id);
      await supabase.from("cut_plans").delete().eq("id", p.id);
    }
    
    // 4. Delete the project itself
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) {
      toast({ title: "Error deleting project", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Project deleted" });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["barlists"] });
    queryClient.invalidateQueries({ queryKey: ["cutPlans"] });
    return true;
  };

  const handleDeleteCustomer = async (node: CustomerNode) => {
    for (const proj of node.projects) {
      if (proj.projectId === "__unassigned__") continue;
      const ok = await handleDeleteProject(proj.projectId);
      if (!ok) return;
    }
    if (node.customerId) {
      // Delete contacts referencing this customer
      await supabase.from("contacts").delete().eq("customer_id", node.customerId);
      const { error } = await supabase.from("customers").delete().eq("id", node.customerId);
      if (error) {
        toast({ title: "Error deleting customer", description: error.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: "Customer deleted" });
    queryClient.invalidateQueries({ queryKey: ["customers-for-queue"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["barlists"] });
    queryClient.invalidateQueries({ queryKey: ["cutPlans"] });
  };

  // Fetch customers for grouping – use project join as fallback for RLS-blocked rows
  const { data: customers } = useQuery({
    queryKey: ["customers-for-queue", projects.map(p => p.customer_id).filter(Boolean)],
    enabled: !!user,
    queryFn: async () => {
      // Direct customer query
      const { data: direct } = await supabase.from("customers").select("id, name").order("name");
      const map = new Map((direct || []).map((c: any) => [c.id, c.name]));

      // Also pull customer names via projects join for any RLS-blocked customers
      const customerIds = projects.map(p => p.customer_id).filter(Boolean) as string[];
      const missingIds = customerIds.filter(id => !map.has(id));
      if (missingIds.length > 0) {
        const { data: fallback } = await supabase
          .from("projects")
          .select("customer_id, customers:customer_id(id, name)")
          .in("customer_id", missingIds);
        (fallback || []).forEach((row: any) => {
          if (row.customers && !map.has(row.customers.id)) {
            map.set(row.customers.id, row.customers.name);
          }
        });
      }

      return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    },
  });

  // Fetch file names for barlists via extract sessions
  const { data: fileNames } = useQuery({
    queryKey: ["barlist-filenames", barlists.map(b => b.id)],
    enabled: barlists.length > 0,
    queryFn: async () => {
      const sessionIds = barlists.map(b => b.extract_session_id).filter(Boolean) as string[];
      if (sessionIds.length === 0) return {};
      const { data } = await supabase
        .from("extract_raw_files")
        .select("session_id, file_name")
        .in("session_id", sessionIds);
      const map: Record<string, string> = {};
      (data || []).forEach((f: any) => { map[f.session_id] = f.file_name; });
      return map;
    },
  });

  const activePlans = plans.filter(p => ["draft", "ready", "running", "queued"].includes(p.status));
  const tree = buildCustomerTree(customers || [], projects, barlists, plans, fileNames || {});

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black italic text-foreground uppercase">Production Queue</h1>
          <p className="text-sm text-muted-foreground">Customer → Projects → Barlists → Manifests</p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/30 gap-1">
          <Activity className="w-3 h-3" />
          {activePlans.length} Active Jobs
        </Badge>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading queue...</p>
      ) : tree.length === 0 ? (
        <p className="text-sm text-muted-foreground">No manifests in queue.</p>
      ) : (
        <div className="space-y-3">
          {tree.map(node => (
            <CustomerFolder
              key={node.customerId || "unassigned"}
              node={node}
              onDeletePlan={deletePlan}
              onEditPlan={(id) => navigate(`/cutter-planning?planId=${id}`)}
              onDeleteBarlist={handleDeleteBarlist}
              onDeleteProject={handleDeleteProject}
              onDeleteCustomer={() => handleDeleteCustomer(node)}
            />
          ))}
        </div>
      )}

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

// --- Tree Builder ---

function buildCustomerTree(
  customers: Array<{ id: string; name: string }>,
  projects: Array<{ id: string; name: string; customer_id: string | null }>,
  barlists: Array<{ id: string; name: string; revision_no: number; project_id: string; extract_session_id: string | null }>,
  plans: PlanNode[],
  fileNames: Record<string, string>
): CustomerNode[] {
  const customerMap = new Map(customers.map(c => [c.id, c.name]));

  // Group projects by customer
  const projectsByCustomer = new Map<string, typeof projects>();
  projects.forEach(p => {
    const cid = p.customer_id || "__none__";
    if (!projectsByCustomer.has(cid)) projectsByCustomer.set(cid, []);
    projectsByCustomer.get(cid)!.push(p);
  });

  // Group barlists by project
  const barlistsByProject = new Map<string, typeof barlists>();
  barlists.forEach(b => {
    const pid = b.project_id || "__none__";
    if (!barlistsByProject.has(pid)) barlistsByProject.set(pid, []);
    barlistsByProject.get(pid)!.push(b);
  });

  // Group plans by project
  const plansByProject = new Map<string, PlanNode[]>();
  const unmatchedPlans: PlanNode[] = [];
  plans.forEach(p => {
    if (p.project_id) {
      if (!plansByProject.has(p.project_id)) plansByProject.set(p.project_id, []);
      plansByProject.get(p.project_id)!.push(p);
    } else {
      unmatchedPlans.push(p);
    }
  });

  // Build project nodes helper
  function buildProjectNode(proj: { id: string; name: string }): ProjectNode {
    const pBarlists = barlistsByProject.get(proj.id) || [];
    const pPlans = plansByProject.get(proj.id) || [];
    const usedPlanIds = new Set<string>();

    const barlistNodes: BarlistNode[] = pBarlists.map(b => {
      const matched = pPlans.filter(p => {
        if (usedPlanIds.has(p.id)) return false;
        return p.name === b.name || p.project_name === b.name;
      });
      matched.forEach(p => usedPlanIds.add(p.id));
      const fn = b.extract_session_id ? fileNames[b.extract_session_id] || null : null;
      return {
        barlistId: b.id,
        barlistName: b.name,
        fileName: fn,
        revisionNo: b.revision_no,
        plans: matched,
      };
    });

    return {
      projectId: proj.id,
      projectName: proj.name,
      barlists: barlistNodes,
      loosePlans: pPlans.filter(p => !usedPlanIds.has(p.id)),
    };
  }

  const result: CustomerNode[] = [];

  // Get all customer IDs that have projects
  const allCustomerIds = new Set(
    projects.map(p => p.customer_id).filter(Boolean) as string[]
  );

  allCustomerIds.forEach(cid => {
    const custProjects = projectsByCustomer.get(cid) || [];
    const projectNodes = custProjects.map(buildProjectNode);
    // Only include if there's actual content
    const hasContent = projectNodes.some(pn => pn.barlists.length > 0 || pn.loosePlans.length > 0);
    if (hasContent || projectNodes.length > 0) {
      result.push({
        customerId: cid,
        customerName: customerMap.get(cid) || "Unknown Customer",
        projects: projectNodes,
      });
    }
  });

  // Projects without a customer
  const orphanProjects = (projectsByCustomer.get("__none__") || []).map(buildProjectNode);
  const orphansWithContent = orphanProjects.filter(pn => pn.barlists.length > 0 || pn.loosePlans.length > 0);

  // Combine orphan projects + unmatched plans
  if (orphansWithContent.length > 0 || unmatchedPlans.length > 0) {
    // Add unmatched plans as a "loose" project
    const looseProject: ProjectNode | null = unmatchedPlans.length > 0 ? {
      projectId: "__unassigned__",
      projectName: "Unassigned",
      barlists: [],
      loosePlans: unmatchedPlans,
    } : null;

    result.push({
      customerId: null,
      customerName: "Unassigned",
      projects: [...orphansWithContent, ...(looseProject ? [looseProject] : [])],
    });
  }

  return result;
}

// --- UI Components ---

function CustomerFolder({ node, onDeletePlan, onEditPlan, onDeleteBarlist, onDeleteProject, onDeleteCustomer }: {
  node: CustomerNode;
  onDeletePlan: (id: string) => void;
  onEditPlan: (id: string) => void;
  onDeleteBarlist: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onDeleteCustomer: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const totalProjects = node.projects.length;
  const totalBarlists = node.projects.reduce((s, p) => s + p.barlists.length, 0);
  const totalManifests = node.projects.reduce((s, p) => s + p.barlists.reduce((s2, b) => s2 + b.plans.length, 0) + p.loosePlans.length, 0);

  return (
    <>
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-0">
        <CollapsibleTrigger asChild>
          <button className="flex-1 flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors text-left">
            {open ? <ChevronDown className="w-4 h-4 text-primary shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            <Users className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-foreground truncate">{node.customerName}</h2>
              <p className="text-[10px] text-muted-foreground">
                {totalProjects} project{totalProjects !== 1 ? "s" : ""} · {totalBarlists} barlist{totalBarlists !== 1 ? "s" : ""}
              </p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{totalManifests} manifest{totalManifests !== 1 ? "s" : ""}</span>
          </button>
        </CollapsibleTrigger>
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 text-destructive/60 hover:text-destructive shrink-0 ml-1"
          onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <CollapsibleContent>
        <div className="ml-4 mt-1 space-y-1 border-l-2 border-primary/15 pl-3">
          {node.projects.map(proj => (
            <ProjectFolder key={proj.projectId} node={proj} onDeletePlan={onDeletePlan} onEditPlan={onEditPlan} onDeleteBarlist={onDeleteBarlist} onDeleteProject={onDeleteProject} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>

    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{node.customerName}"?</AlertDialogTitle>
          <AlertDialogDescription>This will permanently delete this customer and all its projects, barlists, and manifests.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onDeleteCustomer}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function ProjectFolder({ node, onDeletePlan, onEditPlan, onDeleteBarlist, onDeleteProject }: {
  node: ProjectNode;
  onDeletePlan: (id: string) => void;
  onEditPlan: (id: string) => void;
  onDeleteBarlist: (id: string) => void;
  onDeleteProject: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const totalPlans = node.barlists.reduce((s, b) => s + b.plans.length, 0) + node.loosePlans.length;

  return (
    <>
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-0">
        <CollapsibleTrigger asChild>
          <button className="flex-1 flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted/30 transition-colors text-left">
            {open ? <ChevronDown className="w-3.5 h-3.5 text-primary/70 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            <FolderOpen className="w-4 h-4 text-primary/70 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-foreground truncate block">{node.projectName}</span>
              <span className="text-[10px] text-muted-foreground">
                {node.barlists.length} barlist{node.barlists.length !== 1 ? "s" : ""} · {totalPlans} manifest{totalPlans !== 1 ? "s" : ""}
              </span>
            </div>
          </button>
        </CollapsibleTrigger>
        {node.projectId !== "__unassigned__" && (
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-destructive/60 hover:text-destructive shrink-0"
            onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      <CollapsibleContent>
        <div className="ml-5 mt-0.5 space-y-1 border-l border-border pl-3">
          {node.barlists.map(bl => (
            <BarlistFolder key={bl.barlistId} barlist={bl} onDeletePlan={onDeletePlan} onEditPlan={onEditPlan} onDeleteBarlist={onDeleteBarlist} />
          ))}
          {node.loosePlans.map(plan => (
            <QueueCard key={plan.id} plan={plan} onDelete={() => onDeletePlan(plan.id)} onEdit={() => onEditPlan(plan.id)} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>

    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{node.projectName}"?</AlertDialogTitle>
          <AlertDialogDescription>This will permanently delete this project and all its barlists and manifests.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onDeleteProject(node.projectId)}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function BarlistFolder({ barlist, onDeletePlan, onEditPlan, onDeleteBarlist }: {
  barlist: BarlistNode;
  onDeletePlan: (id: string) => void;
  onEditPlan: (id: string) => void;
  onDeleteBarlist: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-0">
        <CollapsibleTrigger asChild>
          <button className="flex-1 flex items-center gap-2 p-2 rounded-md hover:bg-muted/30 transition-colors text-left">
            {open ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
            <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-medium text-foreground truncate">{barlist.barlistName}</span>
              {barlist.fileName && (
                <span className="text-[10px] text-muted-foreground truncate">{barlist.fileName}</span>
              )}
            </div>
            <Badge variant="outline" className="text-[9px] ml-1 shrink-0">Rev {barlist.revisionNo}</Badge>
            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
              {barlist.plans.length} manifest{barlist.plans.length !== 1 ? "s" : ""}
            </span>
          </button>
        </CollapsibleTrigger>
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-destructive/60 hover:text-destructive shrink-0"
          onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <CollapsibleContent>
        <div className="ml-5 mt-0.5 space-y-1">
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

    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{barlist.barlistName}"?</AlertDialogTitle>
          <AlertDialogDescription>This will permanently delete this barlist and all its items.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onDeleteBarlist(barlist.barlistId)}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
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
      <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-card/50 hover:bg-muted/20 transition-colors">
        <div className="flex items-center gap-2.5">
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
            variant="ghost" size="icon"
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
            <AlertDialogDescription>This will permanently delete this manifest and all its items.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
