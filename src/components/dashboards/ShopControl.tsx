import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Hammer, ShieldCheck } from "lucide-react";

const TASK_PHASES = ["queued", "cutting", "cut_done", "bending", "qc_pack", "complete"];

export function ShopControl() {
  const { companyId } = useCompanyId();

  const { data: tasks = [] } = useQuery({
    queryKey: ["shop-control-tasks", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_tasks")
        .select("id, status, qty_required, qty_completed, created_at, mark_number, bar_code, task_type")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const byPhase = useMemo(() => {
    const map: Record<string, number> = {};
    TASK_PHASES.forEach((p) => (map[p] = 0));
    tasks.forEach((t: any) => {
      const phase = t.status || "queued";
      if (map[phase] !== undefined) map[phase]++;
    });
    return map;
  }, [tasks]);

  const totalPieces = useMemo(
    () => tasks.reduce((s, t: any) => s + (t.qty_required || 0), 0),
    [tasks]
  );

  const completedPieces = useMemo(
    () => tasks.reduce((s, t: any) => s + (t.qty_completed || 0), 0),
    [tasks]
  );

  const completionPct = totalPieces > 0 ? Math.round((completedPieces / totalPieces) * 100) : 0;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Hammer className="w-4 h-4" /> Shop Control
      </h3>

      {/* Phase counts */}
      <div className="grid grid-cols-3 gap-2">
        {TASK_PHASES.map((p) => (
          <Card key={p}>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{byPhase[p]}</p>
              <p className="text-[10px] text-muted-foreground">{p.replace(/_/g, " ")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Completion summary */}
      <Card>
        <CardContent className="p-3 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span>Pieces Completed</span>
              <span className="font-semibold">{completedPieces} / {totalPieces}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
          <Badge variant="outline" className="text-xs">{completionPct}%</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Dedup constraint active — duplicate tasks are blocked at database level
          </p>
        </CardContent>
      </Card>

      {tasks.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-6">No production tasks</p>
      )}
    </div>
  );
}
