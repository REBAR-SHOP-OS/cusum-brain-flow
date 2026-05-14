import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CronHealthRow {
  jobid: number;
  jobname: string;
  schedule: string;
  function_name: string | null;
  active: boolean;
  last_start: string | null;
  last_end: string | null;
  last_status: string | null;
  last_message: string | null;
  runs_24h: number;
  failures_24h: number;
  http_auth_failures_24h: number;
}

export default function CronHealth() {
  const [rows, setRows] = useState<CronHealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("get_cron_health" as never);
    if (error) setError(error.message);
    else setRows((data as CronHealthRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const statusBadge = (r: CronHealthRow) => {
    if (!r.last_status) return <Badge variant="outline">No runs</Badge>;
    if (r.last_status === "succeeded" && r.failures_24h === 0 && r.http_auth_failures_24h === 0)
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Healthy
        </Badge>
      );
    if (r.http_auth_failures_24h > 0 || r.failures_24h > 0)
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" /> Failing
        </Badge>
      );
    return (
      <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">
        <AlertTriangle className="w-3 h-3 mr-1" /> Warning
      </Badge>
    );
  };

  const totalAuthFails = rows.reduce((s, r) => s + r.http_auth_failures_24h, 0);
  const totalFails = rows.reduce((s, r) => s + r.failures_24h, 0);
  const healthy = rows.filter(
    (r) => r.last_status === "succeeded" && r.failures_24h === 0 && r.http_auth_failures_24h === 0,
  ).length;

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cron Health</h1>
          <p className="text-sm text-muted-foreground">
            Live status for the 8 monitored scheduled jobs (auto-refreshes every 60s)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Jobs Tracked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{rows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Healthy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{healthy}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Failures (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${totalFails ? "text-destructive" : ""}`}>{totalFails}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Auth Failures (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${totalAuthFails ? "text-destructive" : ""}`}>{totalAuthFails}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="text-destructive text-sm mb-4">{error}</div>}
          {loading && rows.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="text-right">Runs 24h</TableHead>
                  <TableHead className="text-right">Failures 24h</TableHead>
                  <TableHead className="text-right">Auth Fails 24h</TableHead>
                  <TableHead>Last Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.jobid}>
                    <TableCell>
                      <div className="font-medium">{r.jobname}</div>
                      <div className="text-xs text-muted-foreground">{r.function_name}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.schedule}</TableCell>
                    <TableCell>{statusBadge(r)}</TableCell>
                    <TableCell className="text-sm">
                      {r.last_start ? (
                        <span title={r.last_start}>
                          {formatDistanceToNow(new Date(r.last_start), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.runs_24h}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${r.failures_24h ? "text-destructive font-semibold" : ""}`}
                    >
                      {r.failures_24h}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        r.http_auth_failures_24h ? "text-destructive font-semibold" : ""
                      }`}
                    >
                      {r.http_auth_failures_24h}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {r.last_message || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
