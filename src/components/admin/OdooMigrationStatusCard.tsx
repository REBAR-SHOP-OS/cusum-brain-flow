import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Database, CheckCircle, Clock } from "lucide-react";

export function OdooMigrationStatusCard() {
  const history = useRef<number[]>([]);

  const { data } = useQuery({
    queryKey: ["odoo-migration-status"],
    queryFn: async () => {
      const [remainingRes, migratedRes] = await Promise.all([
        supabase
          .from("lead_files")
          .select("*", { count: "exact", head: true })
          .not("odoo_id", "is", null)
          .is("storage_path", null),
        supabase
          .from("lead_files")
          .select("*", { count: "exact", head: true })
          .not("odoo_id", "is", null)
          .not("storage_path", "is", null),
      ]);

      const remaining = remainingRes.count ?? 0;
      const migrated = migratedRes.count ?? 0;

      // Track history for ETA
      const h = history.current;
      h.push(remaining);
      if (h.length > 6) h.shift();

      let etaMinutes: number | null = null;
      if (h.length >= 2 && remaining > 0) {
        const deltas: number[] = [];
        for (let i = 1; i < h.length; i++) {
          const d = h[i - 1] - h[i];
          if (d > 0) deltas.push(d);
        }
        if (deltas.length > 0) {
          const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
          etaMinutes = Math.ceil(remaining / avg);
        }
      }

      return { remaining, migrated, total: remaining + migrated, etaMinutes };
    },
    refetchInterval: 60_000,
  });

  const remaining = data?.remaining ?? 0;
  const migrated = data?.migrated ?? 0;
  const total = data?.total ?? 1;
  const pct = total > 0 ? Math.round((migrated / total) * 100) : 0;
  const done = remaining === 0 && total > 0;
  const eta = data?.etaMinutes;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          Odoo File Migration
        </CardTitle>
        {done ? (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle className="h-3 w-3 mr-1" /> Safe to Shutdown
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-amber-500/15 text-amber-500 border-amber-500/30">
            In Progress
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={pct} className="h-2" />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{migrated.toLocaleString()} / {total.toLocaleString()} migrated</span>
          <span>{pct}%</span>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{remaining.toLocaleString()} remaining</span>
          {eta != null && !done && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ~{eta < 60 ? `${eta}m` : `${Math.floor(eta / 60)}h ${eta % 60}m`}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
