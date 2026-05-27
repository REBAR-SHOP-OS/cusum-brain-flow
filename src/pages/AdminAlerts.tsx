import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, BellOff, BellRing, RefreshCw, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { invalidateFlagCache } from "@/lib/featureFlagService";

interface AlertRow {
  id: string;
  alert_type: string;
  communication_id: string | null;
  owner_email: string | null;
  owner_notified_at: string | null;
  ceo_notified_at: string | null;
  resolved_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const RANGES = [
  { key: "1d", label: "Last 24h", hours: 24 },
  { key: "7d", label: "Last 7 days", hours: 24 * 7 },
  { key: "30d", label: "Last 30 days", hours: 24 * 30 },
];

export default function AdminAlerts() {
  const { isSuperAdmin } = useSuperAdmin();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rangeKey, setRangeKey] = useState("7d");
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  const hours = useMemo(() => RANGES.find((r) => r.key === rangeKey)!.hours, [rangeKey]);

  const loadFlag = async () => {
    const { data } = await supabase
      .from("feature_flags" as never)
      .select("enabled, updated_at")
      .eq("flag_key", "comms_alerts_enabled")
      .maybeSingle();
    const row = data as { enabled: boolean; updated_at: string } | null;
    setEnabled(row?.enabled ?? true);
    setUpdatedAt(row?.updated_at ?? null);
  };

  const loadAlerts = async () => {
    setLoading(true);
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const { data, error } = await supabase
      .from("comms_alerts")
      .select("id, alert_type, communication_id, owner_email, owner_notified_at, ceo_notified_at, resolved_at, created_at, metadata")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast({ title: "Failed to load alerts", description: error.message, variant: "destructive" });
    setRows((data as AlertRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadFlag();
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [hours]);

  const toggle = async (next: boolean) => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("feature_flags")
      .update({ enabled: next, updated_at: new Date().toISOString() })
      .eq("flag_key", "comms_alerts_enabled");
    setSaving(false);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    invalidateFlagCache();
    setEnabled(next);
    setUpdatedAt(new Date().toISOString());
    toast({
      title: next ? "Alerts resumed" : "Alerts paused",
      description: next
        ? "Internal alert emails will resume on the next scheduled run."
        : "comms-alerts, SLA breaches, and timeclock alerts will skip sending.",
    });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.alert_type] = (c[r.alert_type] ?? 0) + 1;
    return c;
  }, [rows]);

  if (!isSuperAdmin) return <Navigate to="/home" replace />;

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Alerts Control Center</h1>
          <p className="text-sm text-muted-foreground">
            Pause/resume internal alert emails and review every alert that has been dispatched.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {enabled ? <BellRing className="w-4 h-4 text-emerald-500" /> : <BellOff className="w-4 h-4 text-red-500" />}
            Master switch
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          {enabled === null ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Switch checked={enabled} onCheckedChange={toggle} disabled={saving} />
              <span className="font-medium">
                {enabled ? "Alerts ENABLED" : "Alerts PAUSED"}
              </span>
              <Badge variant={enabled ? "default" : "destructive"}>
                {enabled ? "Sending" : "Silenced"}
              </Badge>
              {updatedAt && (
                <span className="text-xs text-muted-foreground ml-auto">
                  Last changed {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
                </span>
              )}
            </>
          )}
          <p className="basis-full text-xs text-muted-foreground">
            Covers <code>comms-alerts</code> (unanswered email, missed call), <code>check-sla-breaches</code>,
            and <code>timeclock-alerts</code>. Takes effect on the next cron tick (≤5 min).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Dispatched alerts</CardTitle>
          <div className="flex items-center gap-2">
            {RANGES.map((r) => (
              <Button
                key={r.key}
                size="sm"
                variant={rangeKey === r.key ? "default" : "outline"}
                onClick={() => setRangeKey(r.key)}
              >
                {r.label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={loadAlerts}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(counts).map(([type, n]) => (
              <Badge key={type} variant="secondary">
                {type}: {n}
              </Badge>
            ))}
            <Badge>Total: {rows.length}</Badge>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No alerts in this range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>CEO copy</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const recipient = r.owner_email ?? "—";
                  const ceo = r.ceo_notified_at ? "yes" : "—";
                  const status = r.resolved_at ? "resolved" : "unresolved";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell><Badge variant="outline">{r.alert_type}</Badge></TableCell>
                      <TableCell className="text-xs">{recipient}</TableCell>
                      <TableCell className="text-xs">{ceo}</TableCell>
                      <TableCell>
                        <Badge variant={status === "resolved" ? "default" : "destructive"}>{status}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
