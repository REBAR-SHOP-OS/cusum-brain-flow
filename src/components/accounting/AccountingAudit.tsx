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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

  const runAudit = useCallback(async () => {
    setAuditing(true);
    try {
      // Pre-detect duplicates client-side
      const seen = new Map<string, number>();
      invoices.forEach(i => {
        const key = `${i.CustomerRef?.value}-${i.TotalAmt}-${i.TxnDate}`;
        seen.set(key, (seen.get(key) || 0) + 1);
      });
      const duplicates = Array.from(seen.entries())
        .filter(([, count]) => count > 1)
        .map(([key]) => key);

      // Customers with no invoices
      const customersWithInvoices = new Set(invoices.map(i => i.CustomerRef?.value));
      const dormantCustomers = customers.filter(c => !customersWithInvoices.has(c.Id));

      const totalInvoiced = invoices.reduce((s, i) => s + i.TotalAmt, 0);
      const totalPaid = payments.reduce((s, p) => s + p.TotalAmt, 0);
      const totalAR = invoices.reduce((s, i) => s + i.Balance, 0);
      const totalAP = bills.reduce((s, b) => s + b.Balance, 0);

      const payload = {
        summary: {
          totalAR, totalAP, totalInvoiced, totalPaid,
          invoiceCount: invoices.length,
          billCount: bills.length,
          paymentCount: payments.length,
          customerCount: customers.length,
          vendorCount: vendors.length,
          accountCount: accounts.length,
          collectionRate: totalInvoiced > 0 ? +(totalPaid / totalInvoiced * 100).toFixed(1) : 0,
        },
        overdueInvoices: overdueInvoices.slice(0, 20).map(i => ({
          customer: i.CustomerRef?.name || "Unknown",
          amount: i.Balance,
          dueDate: i.DueDate,
          daysOverdue: Math.floor((Date.now() - new Date(i.DueDate).getTime()) / 86400000),
        })),
        overdueBills: overdueBills.slice(0, 20).map(b => ({
          vendor: b.VendorRef?.name || "Unknown",
          amount: b.Balance,
          dueDate: b.DueDate,
        })),
        largeOpenInvoices: invoices.filter(i => i.Balance > 5000).slice(0, 10).map(i => ({
          customer: i.CustomerRef?.name || "Unknown",
          amount: i.Balance,
        })),
        possibleDuplicates: duplicates.slice(0, 10),
        dormantCustomers: {
          count: dormantCustomers.length,
          names: dormantCustomers.slice(0, 5).map(c => c.DisplayName),
        },
      };

      const { data, error } = await supabase.functions.invoke("qb-audit", { body: payload });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const findings: AuditItem[] = (data?.findings || []).map((f: any, i: number) => ({
        id: f.id || `finding-${i}`,
        type: f.type || "info",
        category: f.category || "General",
        title: f.title || "Finding",
        description: f.description || "",
        actionLabel: f.actionLabel,
        action: f.action,
      }));

      setAuditResults(findings);
      setHasRun(true);
    } catch (err: any) {
      console.error("Audit failed:", err);
      toast.error(err?.message || "Audit failed. Please try again.");
    } finally {
      setAuditing(false);
    }
  }, [invoices, bills, customers, vendors, payments, accounts, overdueInvoices, overdueBills]);

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
