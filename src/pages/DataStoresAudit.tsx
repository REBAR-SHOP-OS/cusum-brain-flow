import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Database, ShieldAlert, HardDrive, AlertTriangle, CheckCircle2, Archive, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";

/* ───────────── types ───────────── */

interface TableStat {
  table_name: string;
  approx_rows: number;
  size_pretty: string;
  size_bytes: number;
}

interface StorageBucketInfo {
  id: string;
  name: string;
  public: boolean;
  object_count: number;
}

type SoTStatus = "active" | "legacy" | "empty" | "reference";

interface SourceOfTruthEntry {
  entity: string;
  table: string;
  status: SoTStatus;
  notes: string;
  rows: number;
}

/* ───────────── static audit data ───────────── */

const SOURCE_OF_TRUTH_MAP: Omit<SourceOfTruthEntry, "rows">[] = [
  // Core entities
  { entity: "Users / Auth", table: "auth.users → profiles", status: "active", notes: "Supabase Auth is source of truth. profiles table mirrors user metadata (name, avatar, role)." },
  { entity: "Roles", table: "user_roles", status: "active", notes: "RBAC via user_roles join table. Roles: admin, sales, accounting, office, workshop, field." },
  { entity: "Customers", table: "customers", status: "active", notes: "CRM master list. 31 rows. Linked to contacts, leads, orders." },
  { entity: "Contacts", table: "contacts", status: "active", notes: "Customer contacts with email/phone. FK → customers." },
  { entity: "Leads / Pipeline", table: "leads", status: "active", notes: "Sales pipeline stages. FK → customers, contacts, quotes." },
  { entity: "Orders", table: "orders", status: "active", notes: "Only 2 rows — may be under-utilized or early stage." },
  { entity: "Quotes", table: "quotes", status: "empty", notes: "0 rows. Table exists but no quotes created yet." },
  
  // Production
  { entity: "Machines", table: "machines", status: "active", notes: "6 machines registered. Source of truth for machine identity." },
  { entity: "Machine Capabilities", table: "machine_capabilities", status: "active", notes: "36 capability entries across machines." },
  { entity: "Machine Runs", table: "machine_runs", status: "active", notes: "Production run tracking. Only 1 row — early usage." },
  { entity: "Production Tasks", table: "production_tasks", status: "empty", notes: "0 rows. Task dispatch system exists but unused." },
  { entity: "Machine Queue", table: "machine_queue_items", status: "empty", notes: "0 rows. Queue system ready but not yet used." },
  { entity: "Cut Plans", table: "cut_plans + cut_plan_items", status: "active", notes: "2 plans, 90 items. Active cutting workflow." },
  { entity: "Cut Output", table: "cut_output_batches", status: "empty", notes: "0 rows. Output tracking not yet used." },
  { entity: "Work Orders", table: "work_orders", status: "active", notes: "2 work orders created." },
  
  // Inventory
  { entity: "Inventory Lots", table: "inventory_lots", status: "empty", notes: "0 rows. Yard stock tracking not populated." },
  { entity: "Floor Stock", table: "floor_stock", status: "empty", notes: "0 rows. Machine-side stock not populated." },
  { entity: "Inventory Reservations", table: "inventory_reservations", status: "empty", notes: "0 rows. Reservation system ready but unused." },
  { entity: "Inventory Scrap", table: "inventory_scrap", status: "empty", notes: "0 rows. Scrap logging not yet active." },
  
  // Delivery
  { entity: "Deliveries", table: "deliveries", status: "empty", notes: "0 rows. Delivery tracking not yet used." },
  { entity: "Delivery Stops", table: "delivery_stops", status: "empty", notes: "0 rows. Stop-level tracking not yet used." },
  { entity: "Pickup Orders", table: "pickup_orders + pickup_order_items", status: "empty", notes: "0 rows. Pickup verification system ready." },
  
  // Communication
  { entity: "Communications", table: "communications", status: "active", notes: "77 rows. Unified inbox (email, SMS, calls)." },
  { entity: "Chat Sessions", table: "chat_sessions + chat_messages", status: "active", notes: "7 sessions, 13 messages. AI agent conversations." },
  { entity: "Notifications", table: "notifications", status: "empty", notes: "0 rows. System exists, no notifications generated yet." },
  
  // Knowledge & AI
  { entity: "Knowledge Base", table: "knowledge", status: "active", notes: "13 entries. Brain/knowledge management." },
  { entity: "Estimation Learnings", table: "estimation_learnings", status: "active", notes: "10 AI learning entries. Auto-correction training data." },
  { entity: "Validation Rules", table: "estimation_validation_rules", status: "active", notes: "8 rules. Estimation boundary checks." },
  { entity: "Shape Schematics", table: "custom_shape_schematics", status: "active", notes: "71 entries. ASA shape reference images." },
  
  // Extract / OCR
  { entity: "Extract Sessions", table: "extract_sessions", status: "active", notes: "2 sessions. PDF → data extraction workflow." },
  { entity: "Extract Rows", table: "extract_rows", status: "active", notes: "90 extracted rebar schedule rows." },
  { entity: "Extract Files", table: "extract_raw_files", status: "active", notes: "2 uploaded files." },
  { entity: "Extract Errors", table: "extract_errors", status: "empty", notes: "0 errors logged." },
  { entity: "Extract Mapping", table: "extract_mapping", status: "active", notes: "1 mapping rule. Field value normalization." },
  
  // Reference
  { entity: "Rebar Sizes", table: "rebar_sizes", status: "reference", notes: "8 entries. RSIC Canada standard reference." },
  { entity: "Rebar Standards", table: "rebar_standards", status: "reference", notes: "6 standard definitions." },
  { entity: "WWM Standards", table: "wwm_standards", status: "reference", notes: "5 welded wire mesh standards." },
  
  // Integrations
  { entity: "Integration Connections", table: "integration_connections", status: "active", notes: "6 connections. External service status tracking." },
  { entity: "Integration Settings", table: "integration_settings", status: "empty", notes: "0 rows. Legacy settings table — superseded by integration_connections." },
  { entity: "Accounting Mirror", table: "accounting_mirror", status: "empty", notes: "0 rows. QuickBooks sync target — not yet connected." },
  
  // HR
  { entity: "Employee Salaries", table: "employee_salaries", status: "active", notes: "9 entries. Admin-only salary records." },
  { entity: "Social Posts", table: "social_posts", status: "empty", notes: "0 rows. Social media manager not yet used." },
  
  // Events
  { entity: "Events Log", table: "events", status: "active", notes: "4 events. System-wide audit trail." },
  { entity: "Tasks", table: "tasks", status: "empty", notes: "0 rows. General task management." },
];

const DEPRECATION_PLAN = [
  {
    item: "Firebase / Firestore",
    status: "removed" as const,
    detail: "All Firebase code, hooks, and config files have been deleted. The firebase npm package has been uninstalled. No Firestore collections exist — the project was migrated to Lovable Cloud before any Firestore data was written.",
  },
  {
    item: "integration_settings table",
    status: "legacy" as const,
    detail: "Superseded by integration_connections. Has 0 rows. Safe to drop in a future migration, but keep for now as it has RLS policies and may be referenced by edge functions.",
  },
  {
    item: "accounting_mirror table",
    status: "waiting" as const,
    detail: "Designed for QuickBooks sync. Currently 0 rows. Will become active once QuickBooks OAuth is connected. Do NOT drop.",
  },
  {
    item: "social_posts table",
    status: "waiting" as const,
    detail: "Social media manager feature exists but no posts created yet. Do NOT drop.",
  },
  {
    item: "estimation-files bucket (multi-purpose)",
    status: "review" as const,
    detail: "Used by Brain uploads, Chat file attachments, and Social media uploads. Should be split into purpose-specific buckets (brain-files, chat-attachments, social-media) for better access control.",
  },
];

const SECURITY_FINDINGS = [
  { item: "estimation-files bucket", risk: "medium", detail: "Public bucket used for multiple features. Any uploaded file is publicly accessible via URL. Consider making non-public and using signed URLs." },
  { item: "avatars bucket", risk: "low", detail: "Public bucket — appropriate for user avatars." },
  { item: "shape-schematics bucket", risk: "low", detail: "Public bucket — appropriate for reference images shared across the org." },
  { item: "No Firestore/Firebase", risk: "none", detail: "Firebase has been fully removed. No Firestore security rules needed." },
  { item: "RLS on all tables", risk: "low", detail: "All 47 tables have RLS enabled. Policies audited in the Construction Cleanup pass." },
];

/* ───────────── hooks ───────────── */

function useTableStats() {
  return useQuery({
    queryKey: ["data-audit-table-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_table_stats");
      if (error) throw new Error(error.message);
      return (data as TableStat[]) || [];
    },
    staleTime: 0,
  });
}

function useStorageBuckets() {
  return useQuery({
    queryKey: ["data-audit-storage"],
    queryFn: async () => {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      if (error) throw new Error(error.message);

      const results: StorageBucketInfo[] = [];
      for (const b of buckets || []) {
        // Count objects in each bucket
        const { data: objects } = await supabase.storage.from(b.id).list("", { limit: 1000 });
        results.push({
          id: b.id,
          name: b.name,
          public: b.public,
          object_count: objects?.length ?? 0,
        });
      }
      return results;
    },
    staleTime: 0,
  });
}

/* ───────────── helpers ───────────── */

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "kB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
    legacy: { label: "Legacy", className: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
    empty: { label: "Empty", className: "bg-muted text-muted-foreground border-border" },
    reference: { label: "Reference", className: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
    removed: { label: "Removed", className: "bg-destructive/10 text-destructive border-destructive/30" },
    waiting: { label: "Waiting", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" },
    review: { label: "Review", className: "bg-purple-500/10 text-purple-500 border-purple-500/30" },
  };
  const cfg = map[status] || map.active;
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
};

const riskBadge = (risk: string) => {
  const map: Record<string, string> = {
    none: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    low: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    medium: "bg-orange-500/10 text-orange-500 border-orange-500/30",
    high: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={map[risk] || map.low}>{risk.toUpperCase()}</Badge>;
};

/* ───────────── component ───────────── */

export default function DataStoresAudit() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats, isFetching: statsFetching } = useTableStats();
  const { data: buckets, isLoading: bucketsLoading, refetch: refetchBuckets, isFetching: bucketsFetching } = useStorageBuckets();

  const isFetching = statsFetching || bucketsFetching;

  const handleRefresh = () => {
    refetchStats();
    refetchBuckets();
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">This page is restricted to administrators only.</p>
        <Button variant="outline" onClick={() => navigate("/home")}>Go Home</Button>
      </div>
    );
  }

  // Merge live row counts into source-of-truth map
  const enrichedSoT: SourceOfTruthEntry[] = SOURCE_OF_TRUTH_MAP.map((entry) => {
    const tableName = entry.table.split(" + ")[0].split(" → ").pop()?.trim() || "";
    const stat = stats?.find((s) => s.table_name === tableName);
    return { ...entry, rows: stat?.approx_rows ?? 0 };
  });

  const totalSize = stats?.reduce((sum, t) => sum + t.size_bytes, 0) || 0;
  const totalRows = stats?.reduce((sum, t) => sum + t.approx_rows, 0) || 0;
  const activeCount = enrichedSoT.filter((e) => e.status === "active").length;
  const emptyCount = enrichedSoT.filter((e) => e.status === "empty").length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <HardDrive className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Data Stores Audit</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-5xl mx-auto p-4 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCard label="Tables" value={stats?.length ?? "—"} />
            <SummaryCard label="Total Rows" value={totalRows.toLocaleString()} />
            <SummaryCard label="Total Size" value={stats ? formatBytes(totalSize) : "—"} />
            <SummaryCard label="Buckets" value={buckets?.length ?? "—"} />
            <SummaryCard label="Files Stored" value={buckets?.reduce((s, b) => s + b.object_count, 0)?.toLocaleString() ?? "—"} />
          </div>

          {/* Firebase / Firestore Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Firebase / Firestore Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">No Firebase/Firestore collections exist.</strong> The project was fully migrated to Lovable Cloud (Postgres) before any Firestore data was written. 
                All Firebase code, hooks (<code>useFirebaseCollection</code>), config (<code>firebase.ts</code>), and the <code>firebase</code> npm package have been removed.
              </p>
            </CardContent>
          </Card>

          <Tabs defaultValue="source-of-truth" className="space-y-4">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="source-of-truth">Source of Truth</TabsTrigger>
              <TabsTrigger value="tables">Postgres Tables</TabsTrigger>
              <TabsTrigger value="storage">Storage Buckets</TabsTrigger>
              <TabsTrigger value="deprecation">Deprecation Plan</TabsTrigger>
            </TabsList>

            {/* Source of Truth Map */}
            <TabsContent value="source-of-truth" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Source of Truth Map — {activeCount} active, {emptyCount} empty
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Every entity has exactly one canonical store (Postgres). No Firestore duplication detected.</p>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entity</TableHead>
                        <TableHead>Table</TableHead>
                        <TableHead className="text-right">Rows</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrichedSoT.map((entry) => (
                        <TableRow key={entry.entity}>
                          <TableCell className="font-medium text-sm">{entry.entity}</TableCell>
                          <TableCell className="font-mono text-xs">{entry.table}</TableCell>
                          <TableCell className="text-right tabular-nums">{entry.rows}</TableCell>
                          <TableCell>{statusBadge(entry.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[300px]">{entry.notes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Postgres Tables */}
            <TabsContent value="tables">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    All Postgres Tables ({stats?.length ?? 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statsLoading && (
                    <div className="space-y-2">
                      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  )}
                  {stats && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Table</TableHead>
                          <TableHead className="text-right">Rows</TableHead>
                          <TableHead className="text-right">Size</TableHead>
                          <TableHead>Usage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.map((row) => (
                          <TableRow key={row.table_name}>
                            <TableCell className="font-mono text-sm">{row.table_name}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.approx_rows.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{row.size_pretty}</TableCell>
                            <TableCell>
                              {row.approx_rows === 0
                                ? <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Empty</Badge>
                                : <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">Active</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Storage Buckets */}
            <TabsContent value="storage">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Archive className="w-4 h-4 text-primary" />
                    Storage Buckets ({buckets?.length ?? 0})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bucketsLoading && <Skeleton className="h-20 w-full" />}
                  {buckets?.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        <Archive className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-mono text-sm font-medium">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{b.object_count} objects</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {b.public
                          ? <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">Public</Badge>
                          : <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">Private</Badge>}
                      </div>
                    </div>
                  ))}

                  <Separator />

                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-orange-500" />
                      Security Findings
                    </h4>
                    <div className="space-y-2">
                      {SECURITY_FINDINGS.map((f, i) => (
                        <div key={i} className="flex items-start gap-3 p-2 rounded border border-border/50">
                          {riskBadge(f.risk)}
                          <div>
                            <p className="text-sm font-medium">{f.item}</p>
                            <p className="text-xs text-muted-foreground">{f.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Deprecation Plan */}
            <TabsContent value="deprecation">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    Migration & Deprecation Plan
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">No data will be deleted without explicit approval. Legacy items are marked for future cleanup.</p>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Plan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {DEPRECATION_PLAN.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{d.item}</TableCell>
                          <TableCell>{statusBadge(d.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[400px]">{d.detail}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="py-3 text-center">
        <p className="text-2xl font-bold text-primary">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
