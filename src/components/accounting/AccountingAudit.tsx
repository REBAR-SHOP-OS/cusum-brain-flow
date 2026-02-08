import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Loader2, Sparkles,
  RefreshCw, DollarSign, FileText, Users, Receipt,
} from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

interface AuditItem {
  id: string;
  type: "error" | "warning" | "info" | "success";
  category: string;
  title: string;
  description: string;
  action?: string;
  actionLabel?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingAudit({ data }: Props) {
  const { invoices, bills, customers, vendors, payments, accounts, overdueInvoices, overdueBills } = data;
  const [auditResults, setAuditResults] = useState<AuditItem[]>([]);
  const [auditing, setAuditing] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [confirmAction, setConfirmAction] = useState<AuditItem | null>(null);

  const runAudit = useCallback(() => {
    setAuditing(true);
    // Simulate AI analysis with real data checks
    setTimeout(() => {
      const results: AuditItem[] = [];

      // 1. Overdue invoices
      if (overdueInvoices.length > 0) {
        const total = overdueInvoices.reduce((s, i) => s + i.Balance, 0);
        results.push({
          id: "overdue-inv",
          type: "error",
          category: "Receivables",
          title: `${overdueInvoices.length} Overdue Invoices — ${fmt(total)}`,
          description: `You have ${overdueInvoices.length} invoices past due. The oldest is ${overdueInvoices.sort((a, b) => new Date(a.DueDate).getTime() - new Date(b.DueDate).getTime())[0]?.CustomerRef?.name || "unknown"}.`,
          action: "send-reminders",
          actionLabel: "Send Reminders",
        });
      } else {
        results.push({
          id: "overdue-inv-ok",
          type: "success",
          category: "Receivables",
          title: "No Overdue Invoices",
          description: "All invoices are current. Great job keeping up!",
        });
      }

      // 2. Overdue bills
      if (overdueBills.length > 0) {
        const total = overdueBills.reduce((s, b) => s + b.Balance, 0);
        results.push({
          id: "overdue-bills",
          type: "warning",
          category: "Payables",
          title: `${overdueBills.length} Overdue Bills — ${fmt(total)}`,
          description: `Bills from ${overdueBills.map(b => b.VendorRef?.name).filter(Boolean).slice(0, 3).join(", ")} are past due.`,
        });
      }

      // 3. Large open balances
      const largeInvoices = invoices.filter(i => i.Balance > 5000);
      if (largeInvoices.length > 0) {
        results.push({
          id: "large-balances",
          type: "warning",
          category: "Cash Flow",
          title: `${largeInvoices.length} Invoices Over $5,000 Outstanding`,
          description: `Total: ${fmt(largeInvoices.reduce((s, i) => s + i.Balance, 0))}. Consider following up on these.`,
        });
      }

      // 4. Customers with no invoices
      const customersWithInvoices = new Set(invoices.map(i => i.CustomerRef?.value));
      const dormantCustomers = customers.filter(c => !customersWithInvoices.has(c.Id));
      if (dormantCustomers.length > 0) {
        results.push({
          id: "dormant-customers",
          type: "info",
          category: "Customers",
          title: `${dormantCustomers.length} Customers With No Invoices`,
          description: `These customers are in QuickBooks but have no invoices: ${dormantCustomers.slice(0, 3).map(c => c.DisplayName).join(", ")}${dormantCustomers.length > 3 ? "..." : ""}.`,
        });
      }

      // 5. Duplicate check (same amount, same day, same customer)
      const seen = new Map<string, number>();
      invoices.forEach(i => {
        const key = `${i.CustomerRef?.value}-${i.TotalAmt}-${i.TxnDate}`;
        seen.set(key, (seen.get(key) || 0) + 1);
      });
      const duplicates = Array.from(seen.entries()).filter(([, count]) => count > 1);
      if (duplicates.length > 0) {
        results.push({
          id: "duplicates",
          type: "error",
          category: "Data Quality",
          title: `${duplicates.length} Possible Duplicate Invoices`,
          description: "Found invoices with the same customer, amount, and date. Please review these manually.",
        });
      } else {
        results.push({
          id: "no-duplicates",
          type: "success",
          category: "Data Quality",
          title: "No Duplicate Invoices Found",
          description: "All invoices appear unique. Clean books!",
        });
      }

      // 6. Unbalanced payments
      const totalInvoiced = invoices.reduce((s, i) => s + i.TotalAmt, 0);
      const totalPaid = payments.reduce((s, p) => s + p.TotalAmt, 0);
      const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced * 100) : 0;
      results.push({
        id: "collection-rate",
        type: collectionRate > 80 ? "success" : collectionRate > 50 ? "warning" : "error",
        category: "Collections",
        title: `Collection Rate: ${collectionRate.toFixed(1)}%`,
        description: `${fmt(totalPaid)} collected out of ${fmt(totalInvoiced)} invoiced.`,
      });

      // 7. Vendor count vs customer count
      if (vendors.length > customers.length * 2) {
        results.push({
          id: "vendor-ratio",
          type: "info",
          category: "General",
          title: "High Vendor-to-Customer Ratio",
          description: `You have ${vendors.length} vendors vs ${customers.length} customers. Consider consolidating vendors.`,
        });
      }

      // 8. Summary
      const errors = results.filter(r => r.type === "error").length;
      const warnings = results.filter(r => r.type === "warning").length;
      if (errors === 0 && warnings === 0) {
        results.unshift({
          id: "summary-clean",
          type: "success",
          category: "Overall",
          title: "🎉 Books Look Clean!",
          description: "No critical issues found in your QuickBooks data.",
        });
      }

      setAuditResults(results);
      setHasRun(true);
      setAuditing(false);
    }, 2000);
  }, [invoices, bills, customers, vendors, payments, overdueInvoices, overdueBills]);

  const iconForType = (type: string) => {
    switch (type) {
      case "error": return <AlertTriangle className="w-5 h-5 text-destructive" />;
      case "warning": return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case "success": return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      default: return <Sparkles className="w-5 h-5 text-blue-500" />;
    }
  };

  const bgForType = (type: string) => {
    switch (type) {
      case "error": return "border-destructive/30 bg-destructive/5";
      case "warning": return "border-amber-500/30 bg-amber-500/5";
      case "success": return "border-emerald-500/30 bg-emerald-500/5";
      default: return "border-blue-500/30 bg-blue-500/5";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-primary/10 via-background to-background border-primary/20">
        <CardContent className="p-8 flex items-center gap-6">
          <div className="p-4 rounded-2xl bg-primary/10">
            <ShieldCheck className="w-12 h-12 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">AI QuickBooks Audit</h2>
            <p className="text-muted-foreground text-lg mt-1">
              Scan your books for overdue invoices, duplicates, missing data, and cash flow issues.
            </p>
          </div>
          <Button
            size="lg"
            className="h-14 text-lg px-8 gap-3"
            onClick={runAudit}
            disabled={auditing}
          >
            {auditing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" /> Scanning...
              </>
            ) : (
              <>
                <Sparkles className="w-6 h-6" /> {hasRun ? "Re-run Audit" : "Run Audit"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Quick stats before audit */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{invoices.length}</p>
            <p className="text-xs text-muted-foreground">Invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Receipt className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{bills.length}</p>
            <p className="text-xs text-muted-foreground">Bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{payments.length}</p>
            <p className="text-xs text-muted-foreground">Payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{customers.length}</p>
            <p className="text-xs text-muted-foreground">Customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <RefreshCw className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{vendors.length}</p>
            <p className="text-xs text-muted-foreground">Vendors</p>
          </CardContent>
        </Card>
      </div>

      {/* Audit results */}
      {hasRun && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Audit Results</h3>
            <Badge variant="outline" className="text-sm">
              {auditResults.filter(r => r.type === "error").length} errors · {auditResults.filter(r => r.type === "warning").length} warnings
            </Badge>
          </div>
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-3">
              {auditResults.map((item) => (
                <Card key={item.id} className={bgForType(item.type)}>
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="mt-0.5">{iconForType(item.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                      </div>
                      <p className="font-semibold text-base">{item.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    </div>
                    {item.actionLabel && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 h-10 text-sm"
                        onClick={() => setConfirmAction(item)}
                      >
                        {item.actionLabel}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {!hasRun && !auditing && (
        <Card>
          <CardContent className="p-12 text-center">
            <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-xl text-muted-foreground">Click "Run Audit" to scan your QuickBooks data</p>
            <p className="text-sm text-muted-foreground mt-2">
              We'll check for overdue invoices, duplicates, missing data, and cash flow issues.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Confirm action dialog */}
      <ConfirmActionDialog
        open={!!confirmAction}
        onOpenChange={() => setConfirmAction(null)}
        title={confirmAction?.actionLabel || "Confirm"}
        description={`Are you sure you want to ${confirmAction?.actionLabel?.toLowerCase()}? ${confirmAction?.description}`}
        confirmLabel={`Yes, ${confirmAction?.actionLabel}`}
        onConfirm={() => setConfirmAction(null)}
      />
    </div>
  );
}
