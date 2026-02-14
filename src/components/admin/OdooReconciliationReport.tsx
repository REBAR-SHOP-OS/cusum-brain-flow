import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ComparisonRow {
  odoo_id: string;
  erp_id: string | null;
  status: "MATCH" | "MISSING_IN_ERP" | "OUT_OF_SYNC" | "DUPLICATE";
  diffs: string[];
  action: string;
  odoo_name: string;
  odoo_stage: string;
  erp_stage?: string;
}

interface ReportData {
  summary: { total: number; match: number; missing: number; out_of_sync: number; duplicate: number };
  results: ComparisonRow[];
}

const statusConfig = {
  MATCH: { label: "Match", variant: "default" as const, icon: CheckCircle2, className: "bg-green-500/10 text-green-600 border-green-500/20" },
  MISSING_IN_ERP: { label: "Missing", variant: "destructive" as const, icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  OUT_OF_SYNC: { label: "Out of Sync", variant: "outline" as const, icon: AlertTriangle, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  DUPLICATE: { label: "Duplicate", variant: "outline" as const, icon: Copy, className: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
};

export function OdooReconciliationReport() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const runReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("odoo-reconciliation-report");
      if (error) throw error;
      setReport(data as ReportData);
      toast({ title: "Report generated", description: `${data.summary.total} Odoo leads compared` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to generate report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Odoo ↔ ERP Reconciliation</h2>
          <p className="text-sm text-muted-foreground">Compare last 5 days of Odoo opportunities with ERP leads</p>
        </div>
        <Button onClick={runReport} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Run Report
        </Button>
      </div>

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total", value: report.summary.total, color: "text-foreground" },
              { label: "Match", value: report.summary.match, color: "text-green-600" },
              { label: "Missing", value: report.summary.missing, color: "text-destructive" },
              { label: "Out of Sync", value: report.summary.out_of_sync, color: "text-amber-600" },
              { label: "Duplicate", value: report.summary.duplicate, color: "text-purple-600" },
            ].map((stat) => (
              <Card key={stat.label} className="p-3 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </Card>
            ))}
          </div>

          {/* Results Table */}
          <Card>
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Odoo ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead>Odoo Stage</TableHead>
                    <TableHead>ERP Stage</TableHead>
                    <TableHead>Diffs</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.results.map((row, i) => {
                    const cfg = statusConfig[row.status];
                    const Icon = cfg.icon;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{row.odoo_id}</TableCell>
                        <TableCell className="text-sm font-medium max-w-[200px] truncate">{row.odoo_name}</TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant} className={`gap-1 text-xs ${cfg.className}`}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{row.odoo_stage}</TableCell>
                        <TableCell className="text-xs">{row.erp_stage || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[200px]">
                          {row.diffs.length > 0 ? row.diffs.join("; ") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.action}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </>
      )}
    </div>
  );
}
