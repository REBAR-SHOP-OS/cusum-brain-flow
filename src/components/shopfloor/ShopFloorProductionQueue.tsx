import { useState, useMemo } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useBarlists } from "@/hooks/useBarlists";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, ChevronDown, Users, FolderOpen, FileText, Activity } from "lucide-react";

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

    // Unassigned
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
          <CustomerGroup key={node.customerId || "unassigned"} node={node} />
        ))}
      </div>
    </section>
  );
}

function CustomerGroup({ node }: { node: { customerId: string | null; customerName: string; projects: { projectId: string; projectName: string; barlists: { id: string; name: string; revisionNo: number; status: string }[] }[] } }) {
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
          <ProjectGroup key={proj.projectId} proj={proj} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProjectGroup({ proj }: { proj: { projectId: string; projectName: string; barlists: { id: string; name: string; revisionNo: number; status: string }[] } }) {
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
          <div key={bl.id} className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted/30 transition-colors">
            <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-foreground truncate">{bl.name}</span>
            <span className="text-muted-foreground text-[10px]">R{bl.revisionNo}</span>
            <StatusBadge status={bl.status} />
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
    active: { label: "Active", cls: "bg-primary/15 text-primary" },
    approved: { label: "Approved", cls: "bg-success/15 text-success" },
    completed: { label: "Done", cls: "bg-success/15 text-success" },
  };
  const info = map[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 ml-auto ${info.cls}`}>{info.label}</Badge>;
}
