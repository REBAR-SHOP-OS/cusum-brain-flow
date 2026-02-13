import { useEffect, useState, useCallback } from "react";
import { Shield, RefreshCw, CheckCircle2, AlertTriangle, XCircle, HelpCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";

type AuditStatus = "connected" | "degraded" | "disconnected" | "not_configured" | "checking";
type RiskLevel = "healthy" | "warning" | "critical";

interface AuditRow {
  id: string;
  name: string;
  group?: string;
  status: AuditStatus;
  lastSync: string | null;
  healthResult: string | null;
  risk: RiskLevel;
  error?: string;
}

const INTEGRATION_CHECKS: {
  id: string;
  name: string;
  group?: string;
  fn: string;
  body: Record<string, unknown>;
}[] = [
  { id: "gmail", name: "Gmail", group: "Google", fn: "google-oauth", body: { action: "check-status", integration: "gmail" } },
  { id: "google-calendar", name: "Google Calendar", group: "Google", fn: "google-oauth", body: { action: "check-status", integration: "google-calendar" } },
  { id: "google-drive", name: "Google Drive", group: "Google", fn: "google-oauth", body: { action: "check-status", integration: "google-drive" } },
  { id: "youtube", name: "YouTube", group: "Google", fn: "google-oauth", body: { action: "check-status", integration: "youtube" } },
  { id: "google-analytics", name: "Google Analytics", group: "Google", fn: "google-oauth", body: { action: "check-status", integration: "google-analytics" } },
  { id: "google-search-console", name: "Search Console", group: "Google", fn: "google-oauth", body: { action: "check-status", integration: "google-search-console" } },
  { id: "quickbooks", name: "QuickBooks", fn: "quickbooks-oauth", body: { action: "check-status" } },
  { id: "ringcentral", name: "RingCentral", fn: "ringcentral-oauth", body: { action: "check-status" } },
  
  { id: "facebook", name: "Facebook", group: "Meta", fn: "facebook-oauth", body: { action: "check-status", integration: "facebook" } },
  { id: "instagram", name: "Instagram", group: "Meta", fn: "facebook-oauth", body: { action: "check-status", integration: "instagram" } },
  { id: "linkedin", name: "LinkedIn", fn: "linkedin-oauth", body: { action: "check-status" } },
  { id: "tiktok", name: "TikTok", fn: "tiktok-oauth", body: { action: "check-status" } },
];

const NOT_CONFIGURED_INTEGRATIONS = [
  { id: "slack", name: "Slack" },
  { id: "notion", name: "Notion" },
  { id: "stripe", name: "Stripe" },
  { id: "twilio", name: "Twilio" },
  { id: "dropbox", name: "Dropbox" },
  { id: "outlook", name: "Outlook" },
];

function deriveRisk(status: AuditStatus): RiskLevel {
  if (status === "connected") return "healthy";
  if (status === "degraded") return "warning";
  if (status === "disconnected" || status === "not_configured") return "critical";
  return "warning";
}

const statusConfig: Record<AuditStatus, { icon: typeof CheckCircle2; label: string; className: string }> = {
  connected: { icon: CheckCircle2, label: "Connected", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  degraded: { icon: AlertTriangle, label: "Degraded", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  disconnected: { icon: XCircle, label: "Disconnected", className: "bg-destructive/15 text-destructive border-destructive/30" },
  not_configured: { icon: HelpCircle, label: "Not Configured", className: "bg-muted text-muted-foreground border-border" },
  checking: { icon: RefreshCw, label: "Checking…", className: "bg-muted text-muted-foreground border-border" },
};

const riskConfig: Record<RiskLevel, { label: string; className: string }> = {
  healthy: { label: "Healthy", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  warning: { label: "Warning", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  critical: { label: "Critical", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

export default function ConnectionsAudit() {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [running, setRunning] = useState(false);
  const [dbConnections, setDbConnections] = useState<Record<string, { lastSync: string | null; error: string | null }>>({});

  // Load integration_connections from DB
  const loadDbConnections = useCallback(async () => {
    const { data } = await supabase.from("integration_connections").select("integration_id, last_sync_at, error_message, status");
    if (data) {
      const map: typeof dbConnections = {};
      data.forEach((c) => {
        map[c.integration_id] = { lastSync: c.last_sync_at, error: c.error_message };
      });
      setDbConnections(map);
    }
  }, []);

  const runAudit = useCallback(async () => {
    setRunning(true);

    // Initialize all rows as "checking"
    const initial: AuditRow[] = [
      ...INTEGRATION_CHECKS.map((c) => ({
        id: c.id,
        name: c.name,
        group: c.group,
        status: "checking" as AuditStatus,
        lastSync: dbConnections[c.id]?.lastSync ?? null,
        healthResult: null,
        risk: "warning" as RiskLevel,
      })),
      ...NOT_CONFIGURED_INTEGRATIONS.map((c) => ({
        id: c.id,
        name: c.name,
        status: "not_configured" as AuditStatus,
        lastSync: null,
        healthResult: "No credentials configured",
        risk: "critical" as RiskLevel,
      })),
    ];
    setRows(initial);

    // Fire all checks in parallel
    const results = await Promise.allSettled(
      INTEGRATION_CHECKS.map(async (check) => {
        try {
          const { data, error } = await supabase.functions.invoke(check.fn, { body: check.body });
          if (error) return { id: check.id, status: "disconnected" as AuditStatus, error: error.message, healthResult: "Edge function error" };
          const s = data?.status === "connected" ? "connected" : data?.status === "degraded" ? "degraded" : "disconnected";
          return {
            id: check.id,
            status: s as AuditStatus,
            error: data?.error || null,
            healthResult: s === "connected" ? `OK${data?.email ? ` — ${data.email}` : ""}${data?.profileName ? ` — ${data.profileName}` : ""}${data?.displayName ? ` — ${data.displayName}` : ""}` : (data?.error || "Check failed"),
          };
        } catch (err) {
          return { id: check.id, status: "disconnected" as AuditStatus, error: String(err), healthResult: "Request failed" };
        }
      })
    );

    setRows((prev) =>
      prev.map((row) => {
        if (NOT_CONFIGURED_INTEGRATIONS.some((n) => n.id === row.id)) return row;
        const result = results.find((r, i) => INTEGRATION_CHECKS[i].id === row.id);
        if (result?.status === "fulfilled") {
          const val = result.value;
          return { ...row, status: val.status, healthResult: val.healthResult, error: val.error ?? undefined, risk: deriveRisk(val.status) };
        }
        return { ...row, status: "disconnected", healthResult: "Check failed", risk: "critical" };
      })
    );

    setRunning(false);
  }, [dbConnections]);

  useEffect(() => {
    loadDbConnections();
  }, [loadDbConnections]);

  useEffect(() => {
    if (Object.keys(dbConnections).length >= 0 && !running && rows.length === 0) {
      runAudit();
    }
  }, [dbConnections]);

  if (roleLoading) return null;
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const connected = rows.filter((r) => r.status === "connected").length;
  const degraded = rows.filter((r) => r.status === "degraded").length;
  const disconnected = rows.filter((r) => r.status === "disconnected").length;
  const notConfigured = rows.filter((r) => r.status === "not_configured").length;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Connections Audit</h1>
            <p className="text-sm text-muted-foreground">Live health check across all external integrations</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/integrations")}>
            <ExternalLink className="w-4 h-4 mr-1" /> Integrations
          </Button>
          <Button size="sm" onClick={runAudit} disabled={running}>
            <RefreshCw className={`w-4 h-4 mr-1 ${running ? "animate-spin" : ""}`} />
            {running ? "Auditing…" : "Re-Audit"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-2xl font-bold">{connected}</p>
                <p className="text-xs text-muted-foreground">Connected</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold">{degraded}</p>
                <p className="text-xs text-muted-foreground">Degraded</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{disconnected}</p>
                <p className="text-xs text-muted-foreground">Disconnected</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <HelpCircle className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{notConfigured}</p>
                <p className="text-xs text-muted-foreground">Not Configured</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Audit table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Integration</TableHead>
                <TableHead>Auth Status</TableHead>
                <TableHead>Health Check</TableHead>
                <TableHead>Data Freshness</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const sc = statusConfig[row.status];
                const StatusIcon = sc.icon;
                const rc = riskConfig[row.risk];
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <div>
                        {row.name}
                        {row.group && <span className="text-xs text-muted-foreground ml-2">({row.group})</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={sc.className}>
                        <StatusIcon className={`w-3 h-3 mr-1 ${row.status === "checking" ? "animate-spin" : ""}`} />
                        {sc.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{row.healthResult ?? "—"}</span>
                      {row.error && row.status !== "not_configured" && (
                        <p className="text-xs text-destructive mt-0.5 truncate max-w-[200px]">{row.error}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {row.lastSync ? new Date(row.lastSync).toLocaleString() : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={rc.className}>{rc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status === "not_configured" ? (
                        <Button variant="outline" size="sm" onClick={() => navigate("/integrations")}>
                          Configure
                        </Button>
                      ) : row.status === "disconnected" ? (
                        <Button variant="outline" size="sm" onClick={() => navigate("/integrations")}>
                          Reconnect
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" disabled={running} onClick={runAudit}>
                          Re-test
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
