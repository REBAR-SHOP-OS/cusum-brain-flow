import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Zap,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserRole } from "@/hooks/useUserRole";
import { edgeFunctionInventory, type EdgeFunctionEntry } from "@/lib/edgeFunctionInventory";

const RISK_CONFIG: Record<EdgeFunctionEntry["risk"], { label: string; className: string }> = {
  critical: { label: "Critical", className: "bg-destructive/15 text-destructive border-destructive/30" },
  high:     { label: "High",     className: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
  medium:   { label: "Medium",   className: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30" },
  low:      { label: "Low",      className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
};

const PRIORITY_CONFIG: Record<EdgeFunctionEntry["migrationPriority"], { label: string; className: string }> = {
  p0: { label: "P0 — Done",    className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  p1: { label: "P1 — Urgent",  className: "bg-destructive/15 text-destructive border-destructive/30" },
  p2: { label: "P2 — Soon",    className: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
  p3: { label: "P3 — Later",   className: "bg-muted text-muted-foreground border-border" },
};

const DOMAIN_LABELS: Record<EdgeFunctionEntry["domain"], string> = {
  auth:          "Auth",
  quotes:        "Quotes",
  orders:        "Orders",
  manufacturing: "Manufacturing",
  delivery:      "Delivery",
  accounting:    "Accounting",
  comms:         "Communications",
  ai:            "AI / Agents",
  admin:         "Admin",
  infra:         "Infrastructure",
};

function BoolIcon({ value }: { value: boolean }) {
  return value
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    : <XCircle className="w-4 h-4 text-muted-foreground/50" />;
}

export default function EdgeFunctionsAudit() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  if (roleLoading) return null;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">This page is restricted to administrators only.</p>
        <Button variant="outline" onClick={() => navigate("/admin")}>
          Go Back
        </Button>
      </div>
    );
  }

  const filtered = edgeFunctionInventory.filter((fn) => {
    if (domainFilter !== "all" && fn.domain !== domainFilter) return false;
    if (priorityFilter !== "all" && fn.migrationPriority !== priorityFilter) return false;
    if (riskFilter !== "all" && fn.risk !== riskFilter) return false;
    return true;
  });

  // Summary stats
  const total = edgeFunctionInventory.length;
  const withWrapper = edgeFunctionInventory.filter((f) => f.usesSharedWrapper).length;
  const withAuditLog = edgeFunctionInventory.filter((f) => f.hasAuditLogging).length;
  const withSmoke = edgeFunctionInventory.filter((f) => f.hasSmokeCoverage).length;
  const criticalOrHigh = edgeFunctionInventory.filter((f) => f.risk === "critical" || f.risk === "high").length;
  const p1Remaining = edgeFunctionInventory.filter((f) => f.migrationPriority === "p1" && !f.usesSharedWrapper).length;

  const domains = Array.from(new Set(edgeFunctionInventory.map((f) => f.domain)));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Zap className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Edge Function Audit</h1>
            <p className="text-sm text-muted-foreground">
              Migration readiness, wrapper adoption, and audit-logging coverage
            </p>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-black text-foreground">{total}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Functions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-black text-emerald-500">{withWrapper}</p>
                <p className="text-xs text-muted-foreground mt-1">Use Shared Wrapper</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-black text-destructive">{total - withWrapper}</p>
                <p className="text-xs text-muted-foreground mt-1">Missing Wrapper</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-black text-foreground">{withAuditLog}</p>
                <p className="text-xs text-muted-foreground mt-1">Audit Logging</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-black text-foreground">{withSmoke}</p>
                <p className="text-xs text-muted-foreground mt-1">Smoke Covered</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className={`text-3xl font-black ${p1Remaining > 0 ? "text-destructive" : "text-emerald-500"}`}>
                  {p1Remaining}
                </p>
                <p className="text-xs text-muted-foreground mt-1">P1 Not Migrated</p>
              </CardContent>
            </Card>
          </div>

          {/* Risk alert */}
          {criticalOrHigh > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-orange-400">
                <span className="font-semibold">{criticalOrHigh} critical/high-risk functions</span> are in the inventory.{" "}
                {p1Remaining > 0 && (
                  <>
                    <span className="font-semibold">{p1Remaining}</span> P1-priority functions still lack the shared auth wrapper.{" "}
                  </>
                )}
                Migrate these before the next production release.
              </p>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Domain" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Domains</SelectItem>
                {domains.map((d) => (
                  <SelectItem key={d} value={d}>{DOMAIN_LABELS[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="p0">P0 — Done</SelectItem>
                <SelectItem value="p1">P1 — Urgent</SelectItem>
                <SelectItem value="p2">P2 — Soon</SelectItem>
                <SelectItem value="p3">P3 — Later</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Risk" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            {(domainFilter !== "all" || priorityFilter !== "all" || riskFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => { setDomainFilter("all"); setPriorityFilter("all"); setRiskFilter("all"); }}
              >
                Clear filters
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} of {total} functions
            </span>
          </div>

          {/* Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Function Inventory</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Function</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="text-center">Wrapper</TableHead>
                    <TableHead className="text-center">Audit Log</TableHead>
                    <TableHead className="text-center">Smoke</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((fn) => {
                    const rc = RISK_CONFIG[fn.risk];
                    const pc = PRIORITY_CONFIG[fn.migrationPriority];
                    return (
                      <TableRow key={fn.name}>
                        <TableCell className="font-mono text-xs font-semibold whitespace-nowrap">
                          {fn.name}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{DOMAIN_LABELS[fn.domain]}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {fn.purpose}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] border ${rc.className}`}>{rc.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] border ${pc.className}`}>{pc.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <BoolIcon value={fn.usesSharedWrapper} />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <BoolIcon value={fn.hasAuditLogging} />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <BoolIcon value={fn.hasSmokeCoverage} />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                          {fn.notes ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                        No functions match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Column Reference</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p><span className="font-semibold text-foreground">Wrapper</span> — uses the shared <code className="bg-muted px-1 rounded">handleRequest</code> auth/CORS/logging stack</p>
              <p><span className="font-semibold text-foreground">Audit Log</span> — writes a structured audit entry (who, what, when) to the DB on every invocation</p>
              <p><span className="font-semibold text-foreground">Smoke</span> — covered by the automated smoke-test suite (<code className="bg-muted px-1 rounded">/smoke-tests</code>)</p>
              <p><span className="font-semibold text-foreground">Priority</span> — P0 migrated, P1 urgent (critical path), P2 soon, P3 later / non-critical</p>
            </CardContent>
          </Card>

        </div>
      </ScrollArea>
    </div>
  );
}
