import { useCutPlans } from "@/hooks/useCutPlans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Pencil, Settings, RotateCcw, Barcode, Star, CheckCircle2, Trash2, 
  Clock, Package, Activity, FolderOpen, FileText 
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function ProductionQueueView() {
  const { plans, loading } = useCutPlans();
  const { user } = useAuth();

  const activePlans = plans.filter(p => ["draft", "ready", "in_progress", "queued"].includes(p.status));

  // Fetch barlist + project names for plans that have project_id
  const planIds = plans.map(p => p.id);
  const { data: planProjects } = useQuery({
    queryKey: ["plan-project-info", planIds],
    enabled: !!user && planIds.length > 0,
    queryFn: async () => {
      // Get barlists linked to work orders that reference these cut plans
      const { data: barlists } = await (supabase as any)
        .from("barlists")
        .select("id, name, revision_no, project:projects(id, name)")
        .order("created_at", { ascending: false })
        .limit(100);
      return (barlists || []) as Array<{
        id: string;
        name: string;
        revision_no: number;
        project: { id: string; name: string } | null;
      }>;
    },
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black italic text-foreground uppercase">Production Queue</h1>
          <p className="text-sm text-muted-foreground">Manage job priority, status, and lifecycle</p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/30 gap-1">
          <Activity className="w-3 h-3" />
          {activePlans.length} Active Jobs
        </Badge>
      </div>

      {/* Queue Cards */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading queue...</p>
      ) : plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No manifests in queue.</p>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => {
            // Try to match a barlist for this plan
            const matchedBarlist = planProjects?.find(b => b.name === plan.name);
            return (
              <QueueCard
                key={plan.id}
                plan={plan}
                projectName={matchedBarlist?.project?.name || null}
                barlistName={matchedBarlist ? `${matchedBarlist.name} (Rev ${matchedBarlist.revision_no})` : null}
              />
            );
          })}
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
          Supervisor PIN is required for <span className="text-destructive font-medium">DELETE</span> and <span className="text-green-500 font-medium">COMPLETE</span> actions. Manifests can be moved back to the initialization stage using the reset button.
        </p>
      </div>
    </div>
  );
}

function QueueCard({ plan, projectName, barlistName }: {
  plan: { id: string; name: string; status: string; project_name: string | null };
  projectName: string | null;
  barlistName: string | null;
}) {
  const statusMap: Record<string, { label: string; color: string }> = {
    draft: { label: "DRAFT", color: "bg-muted text-muted-foreground" },
    ready: { label: "READY_FOR_SHIPPING", color: "bg-yellow-500/20 text-yellow-500" },
    queued: { label: "QUEUED", color: "bg-blue-500/20 text-blue-500" },
    in_progress: { label: "ACTIVE", color: "bg-green-500/20 text-green-500" },
    completed: { label: "COMPLETED", color: "bg-green-500/20 text-green-500" },
  };

  const st = statusMap[plan.status] || statusMap.draft;

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-2.5 h-2.5 rounded-full ${plan.status === "in_progress" ? "bg-green-500" : "bg-muted-foreground/30"}`} />
        <Badge className={`${st.color} text-[10px] tracking-wider`}>{st.label}</Badge>
        <div>
          <h3 className="text-sm font-bold text-foreground">{plan.name}</h3>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
            {projectName && (
              <span className="flex items-center gap-1">
                <FolderOpen className="w-3 h-3" />
                {projectName}
              </span>
            )}
            {barlistName && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {barlistName}
              </span>
            )}
            {!projectName && !barlistName && (
              <>
                <span className="flex items-center gap-1"><Package className="w-3 h-3" /> Mark IDs</span>
                <span>· Unassigned</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Settings className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" className="gap-1 text-xs h-8">
          <Pencil className="w-3 h-3" /> Edit
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Barcode className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Star className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <CheckCircle2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
