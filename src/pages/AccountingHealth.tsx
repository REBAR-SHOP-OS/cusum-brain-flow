import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, AlertTriangle, CheckCircle, Loader2, Search } from "lucide-react";

type Summary = {
  total_invoices: number;
  open_balance_count: number;
  last_invoice_updated_at: string | null;
  missing_customer_qb_id_count: number;
  null_balance_count: number;
};

type TopCustomer = {
  customer_qb_id: string;
  open_balance: number;
  open_invoice_count: number;
};

type DebugResult = {
  invoice_count: number;
  total_open_balance: number;
  invoices: any[] | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function AccountingHealth() {
  const { companyId, isLoading: companyLoading } = useCompanyId();
  const [debugCustomerId, setDebugCustomerId] = useState("");
  const [activeDebugId, setActiveDebugId] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["accounting_health_summary", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("accounting_health_summary", {
        p_company_id: companyId!,
      });
      if (error) throw error;
      return (data as unknown as Summary[])?.[0] ?? null;
    },
  });

  const { data: topCustomers, isLoading: topLoading } = useQuery({
    queryKey: ["accounting_health_top_customers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("accounting_health_top_customers", {
        p_company_id: companyId!,
        p_limit: 20,
      });
      if (error) throw error;
      return (data as unknown as TopCustomer[]) ?? [];
    },
  });

  const { data: debugResult, isLoading: debugLoading, refetch: runDebug } = useQuery({
    queryKey: ["accounting_health_customer_debug", companyId, activeDebugId],
    enabled: !!companyId && !!activeDebugId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("accounting_health_customer_debug", {
        p_company_id: companyId!,
        p_customer_qb_id: activeDebugId!,
      });
      if (error) throw error;
      return (data as unknown as DebugResult[])?.[0] ?? null;
    },
  });

  const loading = companyLoading || summaryLoading || topLoading;

  // Build alerts from summary
  const alerts: { level: "ok" | "warn" | "bad"; text: string }[] = [];
  if (summary) {
    if (summary.total_invoices === 0)
      alerts.push({ level: "bad", text: "No invoices found in qb_transactions — sync may be broken." });
    if (summary.total_invoices > 0 && summary.open_balance_count === 0)
      alerts.push({ level: "warn", text: "No invoices with Balance > 0. Could be real or a mapping issue." });
    if (summary.missing_customer_qb_id_count > 0)
      alerts.push({
        level: "warn",
        text: `${summary.missing_customer_qb_id_count} invoices missing customer_qb_id — join will fail → $0.`,
      });
    if (summary.null_balance_count > 0)
      alerts.push({
        level: "warn",
        text: `${summary.null_balance_count} invoices have NULL balance.`,
      });
  }

  function handleDebug() {
    const trimmed = debugCustomerId.trim();
    if (!trimmed) return;
    setActiveDebugId(trimmed);
  }

  return (
    <div className="space-y-6 p-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Activity className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Accounting Health</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Section A: Mirror Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">A) Mirror Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <StatCard label="Total Invoices" value={summary.total_invoices} />
                    <StatCard label="Open Balance Count" value={summary.open_balance_count} />
                    <StatCard
                      label="Last Updated"
                      value={
                        summary.last_invoice_updated_at
                          ? new Date(summary.last_invoice_updated_at).toLocaleDateString()
                          : "—"
                      }
                    />
                    <StatCard label="Missing Customer ID" value={summary.missing_customer_qb_id_count} />
                    <StatCard label="NULL Balance" value={summary.null_balance_count} />
                  </div>

                  <div className="space-y-2 pt-2">
                    <h3 className="font-semibold text-sm">Alerts</h3>
                    {alerts.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-success">
                        <CheckCircle className="w-4 h-4" /> No obvious issues detected.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {alerts.map((a, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 text-sm"
                          >
                            <AlertTriangle
                              className={`w-4 h-4 mt-0.5 shrink-0 ${
                                a.level === "bad" ? "text-destructive" : "text-warning"
                              }`}
                            />
                            <span>{a.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">No data returned.</p>
              )}
            </CardContent>
          </Card>

          {/* Section B: Top 20 Customers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">B) Top 20 Customer Balances</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {topCustomers && topCustomers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer QB ID</TableHead>
                      <TableHead className="text-right">Open Balance</TableHead>
                      <TableHead className="text-center">Open Invoices</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCustomers.map((c) => (
                      <TableRow
                        key={c.customer_qb_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setDebugCustomerId(c.customer_qb_id);
                          setActiveDebugId(c.customer_qb_id);
                        }}
                      >
                        <TableCell className="font-mono">{c.customer_qb_id}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmt(Number(c.open_balance))}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{c.open_invoice_count}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-center text-muted-foreground">
                  No customers with Balance &gt; 0 found.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section C: Customer Debug Tool */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">C) Customer Debug Tool</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={debugCustomerId}
                    onChange={(e) => setDebugCustomerId(e.target.value)}
                    placeholder="QuickBooks Customer ID (e.g. 123)"
                    className="pl-9"
                    onKeyDown={(e) => e.key === "Enter" && handleDebug()}
                  />
                </div>
                <Button onClick={handleDebug} disabled={debugLoading || !debugCustomerId.trim()}>
                  {debugLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Debug"}
                </Button>
              </div>

              {activeDebugId && !debugLoading && debugResult && (
                <div className="space-y-3">
                  <div className="flex gap-4 text-sm">
                    <span>
                      <strong>Invoices:</strong> {debugResult.invoice_count}
                    </span>
                    <span>
                      <strong>Total Open Balance:</strong>{" "}
                      {fmt(Number(debugResult.total_open_balance ?? 0))}
                    </span>
                  </div>
                  <pre className="bg-muted rounded-lg p-4 text-xs overflow-auto max-h-80">
                    {JSON.stringify(debugResult.invoices, null, 2) ?? "null"}
                  </pre>
                </div>
              )}

              {activeDebugId && !debugLoading && !debugResult && (
                <p className="text-muted-foreground text-sm">
                  No data returned for customer "{activeDebugId}".
                </p>
              )}

              {!activeDebugId && (
                <p className="text-muted-foreground text-sm">
                  Enter a QB Customer ID above to inspect invoices &amp; balance.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{String(value)}</p>
    </div>
  );
}
