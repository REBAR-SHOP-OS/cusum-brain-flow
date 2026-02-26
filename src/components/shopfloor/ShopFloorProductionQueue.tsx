import { useState, useMemo } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useBarlists } from "@/hooks/useBarlists";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ChevronDown, Users, FolderOpen, FileText, Activity, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CutPlanForBarlist {
  id: string;
  name: string;
  status: string;
  machine_id: string | null;
  machine_name: string | null;
  project_id: string | null;
}

interface MachineOption {
  id: string;
  name: string;
}

export function ShopFloorProductionQueue() {
  const { companyId } = useCompanyId();
  const { user } = useAuth();
  const { projects } = useProjects(companyId ?? undefined);
  const { barlists, isLoading } = useBarlists();

  const projectCustomerIds = useMemo(
    () => [...new Set(projects.map(p => p.customer_id).filter(Boolean))] as string[],
    [projects]
  );

  const { data: customers } = useQuery({
    queryKey: ["customers-for-shopfloor-queue", projectCustomerIds],
    enabled: !!user && projectCustomerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name").in("id", projectCustomerIds);
      return (data || []) as Array<{ id: string; name: string }>;
    },
  });

  // Fetch cut_plans for all projects so we can show machine assignment
  const projectIds = useMemo(() => [...new Set(projects.map(p => p.id))], [projects]);

  const { data: cutPlans } = useQuery({
    queryKey: ["cut-plans-for-shopfloor-queue", projectIds],
    enabled: !!user && !!companyId && projectIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("cut_plans")
        .select("id, name, status, machine_id, project_id, machines(name)")
        .eq("company_id", companyId!)
        .in("project_id", projectIds);
      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        machine_id: row.machine_id,
        machine_name: row.machines?.name || null,
        project_id: row.project_id,
      })) as CutPlanForBarlist[];
    },
  });

  // Fetch cutter machines
  const { data: machines } = useQuery({
    queryKey: ["cutter-machines-for-queue"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("machines")
        .select("id, name")
        .eq("type", "cutter")
        .order("name");
      return (data || []) as MachineOption[];
    },
  });

  const cutPlansByProject = useMemo(() => {
    const map = new Map<string, CutPlanForBarlist[]>();
    (cutPlans || []).forEach(cp => {
      if (cp.project_id) {
        if (!map.has(cp.project_id)) map.set(cp.project_id, []);
        map.get(cp.project_id)!.push(cp);
      }
    });
    return map;
  }, [cutPlans]);

  const tree = useMemo(() => {
    const customerMap = new Map((customers || []).map(c => [c.id, c.name]));
    const projectsByCustomer = new Map<string, typeof projects>();
    projects.forEach(p => {
      const cid = p.customer_id || "__none__";
      if (!projectsByCustomer.has(cid)) projectsByCustomer.set(cid, []);
      projectsByCustomer.get(cid)!.push(p);
    });

    const barlistsByProject = new Map<string, typeof barlists>();
    barlists.forEach(b => {
      if (!barlistsByProject.has(b.project_id)) barlistsByProject.set(b.project_id, []);
      barlistsByProject.get(b.project_id)!.push(b);
    });

    type Node = {
      customerId: string | null;
      customerName: string;
      projects: {
        projectId: string;
        projectName: string;
        barlists: { id: string; name: string; revisionNo: number; status: string }[];
      }[];
    };

    const result: Node[] = [];
    const allCids = new Set(projects.map(p => p.customer_id).filter(Boolean) as string[]);

    allCids.forEach(cid => {
      const custProjects = projectsByCustomer.get(cid) || [];
      const projNodes = custProjects.map(p => ({
        projectId: p.id,
        projectName: p.name,
        barlists: (barlistsByProject.get(p.id) || []).map(b => ({
          id: b.id, name: b.name, revisionNo: b.revision_no, status: b.status,
        })),
      })).filter(pn => pn.barlists.length > 0);
      if (projNodes.length > 0) {
        result.push({ customerId: cid, customerName: customerMap.get(cid) || cid.slice(0, 8), projects: projNodes });
      }
    });

    const unassignedProjects = (projectsByCustomer.get("__none__") || [])
      .map(p => ({
        projectId: p.id,
        projectName: p.name,
        barlists: (barlistsByProject.get(p.id) || []).map(b => ({
          id: b.id, name: b.name, revisionNo: b.revision_no, status: b.status,
        })),
      })).filter(pn => pn.barlists.length > 0);
    if (unassignedProjects.length > 0) {
      result.push({ customerId: null, customerName: "Unassigned", projects: unassignedProjects });
    }

    return result;
  }, [customers, projects, barlists]);

  const totalBarlists = barlists.length;

  if (isLoading) return null;
  if (tree.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Production Queue
        </h2>
        <Badge variant="outline" className="text-xs gap-1">
          {totalBarlists} Barlists
        </Badge>
      </div>

      <div className="space-y-2">
        {tree.map(node => (
          <CustomerGroup
            key={node.customerId || "unassigned"}
            node={node}
            cutPlansByProject={cutPlansByProject}
            machines={machines || []}
          />
        ))}
      </div>
    </section>
  );
}

function CustomerGroup({
  node,
  cutPlansByProject,
  machines,
}: {
  node: { customerId: string | null; customerName: string; projects: { projectId: string; projectName: string; barlists: { id: string; name: string; revisionNo: number; status: string }[] }[] };
  cutPlansByProject: Map<string, CutPlanForBarlist[]>;
  machines: MachineOption[];
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md bg-muted/50 hover:bg-muted transition-colors">
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        <Users className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wide text-foreground">{node.customerName}</span>
        <Badge variant="secondary" className="text-[10px] ml-auto">
          {node.projects.reduce((s, p) => s + p.barlists.length, 0)} lists
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-5 pt-1 space-y-1">
        {node.projects.map(proj => (
          <ProjectGroup
            key={proj.projectId}
            proj={proj}
            cutPlans={cutPlansByProject.get(proj.projectId) || []}
            machines={machines}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProjectGroup({
  proj,
  cutPlans,
  machines,
}: {
  proj: { projectId: string; projectName: string; barlists: { id: string; name: string; revisionNo: number; status: string }[] };
  cutPlans: CutPlanForBarlist[];
  machines: MachineOption[];
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-muted/40 transition-colors">
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <FolderOpen className="w-3 h-3 text-primary/70" />
        <span className="text-xs font-semibold text-foreground">{proj.projectName}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pt-0.5 space-y-0.5">
        {proj.barlists.map(bl => (
          <BarlistRow key={bl.id} bl={bl} cutPlans={cutPlans} machines={machines} projectId={proj.projectId} />
        ))}
        {/* Show cut plans with machine assignment */}
        {cutPlans.length > 0 && (
          <div className="pt-1 space-y-1">
            {cutPlans.map(cp => (
              <CutPlanRow key={cp.id} plan={cp} machines={machines} />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function BarlistRow({
  bl,
  cutPlans,
  machines,
  projectId,
}: {
  bl: { id: string; name: string; revisionNo: number; status: string };
  cutPlans: CutPlanForBarlist[];
  machines: MachineOption[];
  projectId: string;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted/30 transition-colors">
      <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-foreground truncate">{bl.name}</span>
      <span className="text-muted-foreground text-[10px]">R{bl.revisionNo}</span>
      <StatusBadge status={bl.status} />
    </div>
  );
}

function CutPlanRow({ plan, machines }: { plan: CutPlanForBarlist; machines: MachineOption[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = useState(false);

  const handleAssign = async (machineId: string) => {
    setAssigning(true);
    const { error } = await supabase
      .from("cut_plans")
      .update({ machine_id: machineId, status: "queued" })
      .eq("id", plan.id);

    if (error) {
      toast({ title: "Failed to assign", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Assigned to ${machines.find(m => m.id === machineId)?.name || "machine"}` });
      queryClient.invalidateQueries({ queryKey: ["cut-plans-for-shopfloor-queue"] });
      queryClient.invalidateQueries({ queryKey: ["station-data"] });
    }
    setAssigning(false);
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs bg-muted/20 hover:bg-muted/40 transition-colors">
      <Wrench className="w-3 h-3 text-primary/70 shrink-0" />
      <span className="text-foreground truncate">{plan.name}</span>
      <StatusBadge status={plan.status} />

      {plan.machine_name ? (
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-auto">
          {plan.machine_name}
        </Badge>
      ) : (
        <div className="ml-auto" onClick={e => e.stopPropagation()}>
          <Select onValueChange={handleAssign} disabled={assigning}>
            <SelectTrigger className="h-6 text-[10px] w-[110px] px-2 py-0 border-primary/30">
              <SelectValue placeholder="Assign machine" />
            </SelectTrigger>
            <SelectContent>
              {machines.map(m => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
    active: { label: "Active", cls: "bg-primary/15 text-primary" },
    approved: { label: "Approved", cls: "bg-success/15 text-success" },
    completed: { label: "Done", cls: "bg-success/15 text-success" },
    queued: { label: "Queued", cls: "bg-primary/15 text-primary" },
    running: { label: "Running", cls: "bg-warning/15 text-warning" },
  };
  const info = map[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 ml-auto ${info.cls}`}>{info.label}</Badge>;
}
