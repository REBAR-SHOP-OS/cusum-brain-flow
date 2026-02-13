import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings, CheckCircle, Clock, AlertTriangle, ChevronDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface MigrationLog {
  id: string;
  created_at: string;
  migrated: number;
  failed: number;
  remaining: number;
  elapsed_s: number;
  errors: string[];
  status: string;
}

export function OdooMigrationStatusCard() {
  const history = useRef<number[]>([]);
  const [errorsOpen, setErrorsOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["odoo-migration-status"],
    queryFn: async () => {
      const [remainingRes, migratedRes, logsRes] = await Promise.all([
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
        supabase
          .from("migration_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const remaining = remainingRes.count ?? 0;
      const migrated = migratedRes.count ?? 0;
      const logs = (logsRes.data ?? []) as unknown as MigrationLog[];

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

      return { remaining, migrated, total: remaining + migrated, etaMinutes, logs };
    },
    refetchInterval: 60_000,
  });

  const remaining = data?.remaining ?? 0;
  const migrated = data?.migrated ?? 0;
  const total = data?.total ?? 1;
  const pct = total > 0 ? Math.round((migrated / total) * 100) : 0;
  const done = remaining === 0 && total > 0;
  const eta = data?.etaMinutes;
  const logs = data?.logs ?? [];

  // Live pulse: green if last log < 2 min ago, red if stale
  const lastLog = logs[0];
  const lastLogAge = lastLog ? Date.now() - new Date(lastLog.created_at).getTime() : Infinity;
  const isAlive = lastLogAge < 2 * 60 * 1000;

  // Errors from recent logs
  const recentErrors = logs
    .filter((l) => l.status !== "success" || l.failed > 0)
    .slice(0, 5);
  const allErrors = recentErrors.flatMap((l) =>
    l.errors.map((e) => ({ message: e, time: l.created_at, status: l.status }))
  );
  const hasErrors = allErrors.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Settings
            className={`h-4 w-4 text-muted-foreground ${!done ? "animate-spin" : ""}`}
            style={!done ? { animationDuration: "3s" } : undefined}
          />
          Odoo File Migration
          {/* Live pulse indicator */}
          {!done && (
            <span className="relative flex h-2.5 w-2.5 ml-1">
              {isAlive ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-[hsl(var(--primary))]" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[hsl(var(--primary))]" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
              )}
            </span>
          )}
        </CardTitle>
        {done ? (
          <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <CheckCircle className="h-3 w-3 mr-1" /> Complete
          </Badge>
        ) : hasErrors ? (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" /> Errors Detected
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-accent text-accent-foreground">
            In Progress
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={pct} className="h-2" />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            {migrated.toLocaleString()} / {total.toLocaleString()} migrated
          </span>
          <span>{pct}%</span>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{remaining.toLocaleString()} remaining</span>
          {eta != null && !done && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />~
              {eta < 60 ? `${eta}m` : `${Math.floor(eta / 60)}h ${eta % 60}m`}
            </span>
          )}
          {lastLog && (
            <span className="ml-auto">
              Last run: {formatDistanceToNow(new Date(lastLog.created_at), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Error log panel */}
        {hasErrors && (
          <Collapsible open={errorsOpen} onOpenChange={setErrorsOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-destructive font-medium w-full hover:underline">
              <AlertTriangle className="h-3 w-3" />
              {allErrors.length} error{allErrors.length !== 1 ? "s" : ""} in recent runs
              <ChevronDown
                className={`h-3 w-3 ml-auto transition-transform ${errorsOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1">
              {allErrors.slice(0, 10).map((err, i) => (
                <div
                  key={i}
                  className="text-xs bg-destructive/10 text-destructive rounded px-2 py-1 font-mono break-all"
                >
                  <span className="opacity-60">
                    [{formatDistanceToNow(new Date(err.time), { addSuffix: true })}]
                  </span>{" "}
                  {err.message}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Cron stale warning */}
        {!done && !isAlive && lastLog && (
          <div className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Cron appears stale — no runs in the last 2 minutes
          </div>
        )}
      </CardContent>
    </Card>
  );
}
