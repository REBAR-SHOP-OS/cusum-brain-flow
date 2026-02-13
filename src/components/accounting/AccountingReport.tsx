import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
  report: "balance-sheet" | "profit-loss" | "cash-flow";
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingReport({ data, report }: Props) {
  const { totalReceivable, totalPayable, invoices, bills, payments } = data;
  const totalPayments = payments.reduce((s, p) => s + p.TotalAmt, 0);
  const totalInvoiced = invoices.reduce((s, i) => s + i.TotalAmt, 0);
  const totalBilled = bills.reduce((s, b) => s + b.TotalAmt, 0);

  const titles: Record<string, string> = {
    "balance-sheet": "Balance Sheet",
    "profit-loss": "Profit and Loss",
    "cash-flow": "Cash Flow Statement",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          {titles[report]}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generated from QuickBooks data · {new Date().toLocaleDateString()}
        </p>
      </div>

      {report === "balance-sheet" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-1">Total Assets (AR)</p>
              <p className="text-3xl font-bold text-success">{fmt(totalReceivable)}</p>
              <p className="text-xs text-muted-foreground mt-1">{invoices.filter(i => i.Balance > 0).length} outstanding invoices</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-1">Total Liabilities (AP)</p>
              <p className="text-3xl font-bold text-primary">{fmt(totalPayable)}</p>
              <p className="text-xs text-muted-foreground mt-1">{bills.filter(b => b.Balance > 0).length} outstanding bills</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-1">Net Position</p>
              <p className={`text-3xl font-bold ${totalReceivable - totalPayable >= 0 ? "text-success" : "text-destructive"}`}>
                {fmt(totalReceivable - totalPayable)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {report === "profit-loss" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-success" />
                <p className="text-sm text-muted-foreground">Revenue (Invoiced)</p>
              </div>
              <p className="text-3xl font-bold text-success">{fmt(totalInvoiced)}</p>
              <p className="text-xs text-muted-foreground mt-1">{invoices.length} invoices</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-primary" />
                <p className="text-sm text-muted-foreground">Expenses (Bills)</p>
              </div>
              <p className="text-3xl font-bold text-primary">{fmt(totalBilled)}</p>
              <p className="text-xs text-muted-foreground mt-1">{bills.length} bills</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-primary" />
                <p className="text-sm text-muted-foreground">Net Income</p>
              </div>
              <p className={`text-3xl font-bold ${totalInvoiced - totalBilled >= 0 ? "text-success" : "text-destructive"}`}>
                {fmt(totalInvoiced - totalBilled)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {report === "cash-flow" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-success" />
                <p className="text-sm text-muted-foreground">Cash Received</p>
              </div>
              <p className="text-3xl font-bold text-success">{fmt(totalPayments)}</p>
              <p className="text-xs text-muted-foreground mt-1">{payments.length} payments</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-primary" />
                <p className="text-sm text-muted-foreground">Cash Paid Out</p>
              </div>
              <p className="text-3xl font-bold text-primary">{fmt(totalBilled - totalPayable)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-primary" />
                <p className="text-sm text-muted-foreground">Outstanding Receivable</p>
              </div>
              <p className="text-3xl font-bold text-primary">{fmt(totalReceivable)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <p className="text-sm">Summary view generated from synced QuickBooks data. These are high-level aggregations — not a full GL report.</p>
          <p className="text-xs mt-1">For the full report, check your QuickBooks dashboard.</p>
        </CardContent>
      </Card>
    </div>
  );
}

AccountingReport.displayName = "AccountingReport";
