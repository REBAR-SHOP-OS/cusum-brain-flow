import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  RefreshCw, FileText, Receipt, CreditCard, Users,
} from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
  onNavigate: (tab: string) => void;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle?: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all ${onClick ? "" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-xl bg-muted`}>
            <Icon className={`w-7 h-7 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingDashboard({ data, onNavigate }: Props) {
  const {
    totalReceivable, totalPayable, overdueInvoices, overdueBills,
    invoices, bills, payments, customers, syncing, syncEntity,
  } = data;

  const recentPayments = payments
    .sort((a, b) => new Date(b.TxnDate).getTime() - new Date(a.TxnDate).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Quick sync bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          variant="outline"
          className="h-12 text-base gap-2"
          onClick={() => syncEntity("customers")}
          disabled={!!syncing}
        >
          <RefreshCw className={`w-5 h-5 ${syncing === "customers" ? "animate-spin" : ""}`} />
          Sync Customers
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12 text-base gap-2"
          onClick={() => syncEntity("invoices")}
          disabled={!!syncing}
        >
          <RefreshCw className={`w-5 h-5 ${syncing === "invoices" ? "animate-spin" : ""}`} />
          Sync Invoices
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12 text-base gap-2"
          onClick={() => syncEntity("vendors")}
          disabled={!!syncing}
        >
          <RefreshCw className={`w-5 h-5 ${syncing === "vendors" ? "animate-spin" : ""}`} />
          Sync Vendors
        </Button>
      </div>

      {/* Big stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Money Coming In (AR)"
          value={fmt(totalReceivable)}
          subtitle={`${invoices.length} invoices`}
          color="text-emerald-500"
          onClick={() => onNavigate("invoices")}
        />
        <StatCard
          icon={TrendingDown}
          label="Money Going Out (AP)"
          value={fmt(totalPayable)}
          subtitle={`${bills.length} bills`}
          color="text-blue-500"
          onClick={() => onNavigate("bills")}
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue Invoices"
          value={String(overdueInvoices.length)}
          subtitle={overdueInvoices.length > 0 ? fmt(overdueInvoices.reduce((s, i) => s + i.Balance, 0)) : "All good! ✅"}
          color={overdueInvoices.length > 0 ? "text-destructive" : "text-emerald-500"}
          onClick={() => onNavigate("invoices")}
        />
        <StatCard
          icon={DollarSign}
          label="Customers"
          value={String(customers.length)}
          subtitle={`${payments.length} payments recorded`}
          color="text-primary"
          onClick={() => onNavigate("customers")}
        />
      </div>

      {/* Overdue alerts */}
      {overdueInvoices.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              ⚠️ {overdueInvoices.length} Overdue Invoices Need Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueInvoices.slice(0, 5).map((inv) => (
                <div key={inv.Id} className="flex items-center justify-between p-3 rounded-lg bg-background">
                  <div>
                    <p className="font-semibold text-base">#{inv.DocNumber} — {inv.CustomerRef?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Due {new Date(inv.DueDate).toLocaleDateString()} · {Math.ceil((Date.now() - new Date(inv.DueDate).getTime()) / 86400000)} days late
                    </p>
                  </div>
                  <Badge variant="destructive" className="text-base px-3 py-1">
                    {fmt(inv.Balance)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Button size="lg" className="h-14 text-lg gap-3" onClick={() => onNavigate("invoices")}>
          <FileText className="w-6 h-6" /> Invoices
        </Button>
        <Button size="lg" className="h-14 text-lg gap-3" variant="secondary" onClick={() => onNavigate("bills")}>
          <Receipt className="w-6 h-6" /> Bills & Vendors
        </Button>
        <Button size="lg" className="h-14 text-lg gap-3" variant="secondary" onClick={() => onNavigate("payments")}>
          <CreditCard className="w-6 h-6" /> Payments
        </Button>
        <Button size="lg" className="h-14 text-lg gap-3" variant="secondary" onClick={() => onNavigate("audit")}>
          <Users className="w-6 h-6" /> AI Audit
        </Button>
      </div>

      {/* Recent payments */}
      {recentPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">💰 Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentPayments.map((pay) => (
                <div key={pay.Id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-base">{pay.CustomerRef?.name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">{new Date(pay.TxnDate).toLocaleDateString()}</p>
                  </div>
                  <Badge variant="outline" className="text-base px-3 py-1 text-emerald-500 border-emerald-500/30">
                    +{fmt(pay.TotalAmt)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
