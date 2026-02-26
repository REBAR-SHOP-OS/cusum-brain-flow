import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FileText, Receipt, DollarSign,
  Plus, AlertTriangle, MoreVertical, Bot,
} from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";
import { usePennyQueue } from "@/hooks/usePennyQueue";
import { useQBBankActivity } from "@/hooks/useQBBankActivity";
import { BankAccountsCard } from "@/components/accounting/BankAccountsCard";
import { FinancialSnapshot } from "@/components/accounting/FinancialSnapshot";
import { AlertsBanner } from "@/components/accounting/AlertsBanner";
import { useMemo } from "react";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
  onNavigate: (tab: string) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/* ── Mini Bar Chart ────────────────────────────────────────────── */

function MiniBarChart({ data }: { data: { label: string; value: number; highlight?: boolean }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-20 mt-4">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
          <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
            {d.value > 0 ? d.value : ""}
          </span>
          <div
            className={`w-full rounded transition-all ${
              d.highlight ? "bg-primary" : "bg-muted-foreground/20"
            }`}
            style={{ height: `${Math.max((d.value / max) * 56, 4)}px` }}
          />
          <span className="text-[10px] text-muted-foreground truncate w-full text-center">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Invoices Card ─────────────────────────────────────────────── */

function InvoicesCard({ data, onNavigate }: Props) {
  const { invoices, overdueInvoices, totalReceivable } = data;
  const unpaid = invoices.filter((i) => i.Balance > 0);
  const unpaidTotal = unpaid.reduce((s, i) => s + i.Balance, 0);
  const lateTotal = overdueInvoices.reduce((s, i) => s + i.Balance, 0);
  const collectedPct = totalReceivable > 0
    ? Math.round(((totalReceivable - unpaidTotal) / totalReceivable) * 100)
    : 100;

  const hasOverdue = overdueInvoices.length > 0;
  const borderColor = hasOverdue ? "border-l-destructive" : "border-l-emerald-500";

  const now = new Date();
  const weekMs = 7 * 86400000;
  const dueBuckets = useMemo(() => {
    const buckets = [
      { label: "Overdue", value: 0, highlight: false },
      { label: "This Wk", value: 0, highlight: true },
      { label: "Next Wk", value: 0, highlight: false },
      { label: "Later", value: 0, highlight: false },
    ];
    invoices.forEach((inv) => {
      if (inv.Balance <= 0) return;
      const diff = new Date(inv.DueDate).getTime() - now.getTime();
      if (diff < 0) buckets[0].value++;
      else if (diff < weekMs) buckets[1].value++;
      else if (diff < weekMs * 2) buckets[2].value++;
      else buckets[3].value++;
    });
    return buckets;
  }, [invoices]);

  return (
    <Card
      className={`cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all border-l-4 ${borderColor}`}
      onClick={() => onNavigate("invoices")}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base">Receivables</h3>
          </div>
          <Button
            size="sm"
            variant="default"
            className="text-xs gap-1.5"
            onClick={(e) => { e.stopPropagation(); onNavigate("invoices"); }}
          >
            <Plus className="w-3 h-3" /> New Invoice
          </Button>
        </div>

        {/* Collection progress */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">{collectedPct}% collected</span>
            <span className="font-medium tabular-nums">{fmt(totalReceivable)}</span>
          </div>
          <Progress value={collectedPct} className="h-2" />
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{invoices.length} Total Invoices</span>
            <span className="font-semibold tabular-nums">{fmt(totalReceivable)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-primary font-medium">{unpaid.length} Unpaid</span>
            <span className="font-semibold tabular-nums text-primary">{fmt(unpaidTotal)}</span>
          </div>
          {overdueInvoices.length > 0 && (
            <div className="flex justify-between">
              <span className="text-destructive flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> {overdueInvoices.length} Overdue
              </span>
              <span className="font-semibold tabular-nums text-destructive">{fmt(lateTotal)}</span>
            </div>
          )}
        </div>

        <MiniBarChart data={dueBuckets} />
      </CardContent>
    </Card>
  );
}

/* ── Bills Card ────────────────────────────────────────────────── */

function BillsCard({ data, onNavigate }: Props) {
  const { bills, overdueBills, totalPayable } = data;
  const unpaid = bills.filter((b) => b.Balance > 0);
  const hasOverdue = overdueBills.length > 0;
  const borderColor = hasOverdue ? "border-l-orange-500" : "border-l-emerald-500";

  const now = new Date();
  const weekMs = 7 * 86400000;
  const dueBuckets = useMemo(() => {
    const buckets = [
      { label: "Overdue", value: 0, highlight: false },
      { label: "This Wk", value: 0, highlight: true },
      { label: "Next Wk", value: 0, highlight: false },
      { label: "Later", value: 0, highlight: false },
    ];
    bills.forEach((b) => {
      if (b.Balance <= 0) return;
      const diff = new Date(b.DueDate).getTime() - now.getTime();
      if (diff < 0) buckets[0].value++;
      else if (diff < weekMs) buckets[1].value++;
      else if (diff < weekMs * 2) buckets[2].value++;
      else buckets[3].value++;
    });
    return buckets;
  }, [bills]);

  return (
    <Card
      className={`cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all border-l-4 ${borderColor}`}
      onClick={() => onNavigate("bills")}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base">Payables</h3>
          </div>
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{bills.length} Total Bills</span>
            <span className="font-semibold tabular-nums">{fmt(totalPayable)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-primary font-medium">{unpaid.length} Open</span>
            <span className="font-semibold tabular-nums text-primary">
              {fmt(unpaid.reduce((s, b) => s + b.Balance, 0))}
            </span>
          </div>
          {overdueBills.length > 0 && (
            <div className="flex justify-between">
              <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> {overdueBills.length} Overdue
              </span>
              <span className="font-semibold tabular-nums text-orange-600 dark:text-orange-400">
                {fmt(overdueBills.reduce((s, b) => s + b.Balance, 0))}
              </span>
            </div>
          )}
        </div>

        <MiniBarChart data={dueBuckets} />
      </CardContent>
    </Card>
  );
}

/* ── Cash & Recent Payments Card ───────────────────────────────── */

function CashCard({ data, onNavigate }: Props) {
  const totalPayments = data.payments.reduce((s, p) => s + p.TotalAmt, 0);
  const recentPayments = [...data.payments]
    .sort((a, b) => new Date(b.TxnDate).getTime() - new Date(a.TxnDate).getTime())
    .slice(0, 3);

  return (
    <Card
      className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
      onClick={() => onNavigate("payments")}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base">Cash & Payments</h3>
          </div>
          <Button
            size="sm"
            variant="default"
            className="text-xs gap-1.5"
            onClick={(e) => { e.stopPropagation(); onNavigate("payments"); }}
          >
            <Plus className="w-3 h-3" /> New Transaction
          </Button>
        </div>

        <div className="flex justify-between text-sm mb-4">
          <span className="text-muted-foreground">{data.payments.length} Payments</span>
          <span className="text-lg font-bold tabular-nums">{fmt(totalPayments)}</span>
        </div>

        {recentPayments.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent</span>
            {recentPayments.map((p) => (
              <div key={p.Id} className="flex justify-between text-sm">
                <span className="text-muted-foreground truncate max-w-[60%]">
                  {p.CustomerRef?.name || "Payment"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.TxnDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span className="font-medium tabular-nums">{fmt(p.TotalAmt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Penny's Queue Card ────────────────────────────────────────── */

function PennyQueueCard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { pendingCount, totalAtRisk, nextFollowup, items } = usePennyQueue();
  const completedCount = items.filter((i) => i.status === "executed" || i.status === "approved").length;
  const totalItems = pendingCount + completedCount;
  const progressPct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 100;

  return (
    <Card
      className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
      onClick={() => onNavigate("actions")}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base">Penny's Queue</h3>
          </div>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-xs px-2 py-0.5">{pendingCount}</Badge>
          )}
        </div>

        {pendingCount > 0 && (
          <p className="text-sm text-muted-foreground mb-3">
            {pendingCount} item{pendingCount !== 1 && "s"} need attention
          </p>
        )}

        {totalItems > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">{completedCount}/{totalItems} processed</span>
              <span className="font-medium">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">AR at Risk</span>
            <span className="font-semibold tabular-nums">{fmt(totalAtRisk)}</span>
          </div>
          {nextFollowup && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Next Follow-up</span>
              <span className="text-xs font-medium">{nextFollowup}</span>
            </div>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          className="text-xs mt-4 gap-1.5 w-full"
          onClick={(e) => { e.stopPropagation(); onNavigate("actions"); }}
        >
          <Bot className="w-3 h-3" /> Review Actions
        </Button>
      </CardContent>
    </Card>
  );
}

/* ── Main Dashboard ────────────────────────────────────────────── */

export function AccountingDashboard({ data, onNavigate }: Props) {
  const bankAccounts = data.accounts.filter((a) => a.AccountType === "Bank" && a.Active);
  const { getActivity, upsertBankBalance, triggerSync, syncing } = useQBBankActivity();

  return (
    <div className="space-y-4">
      {/* 1. Financial Snapshot */}
      <FinancialSnapshot data={data} bankAccounts={bankAccounts} />

      {/* 2. Alerts Banner */}
      <AlertsBanner data={data} onNavigate={onNavigate} />

      {/* 3. Receivables & Payables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InvoicesCard data={data} onNavigate={onNavigate} />
        <BillsCard data={data} onNavigate={onNavigate} />
      </div>

      {/* 4. Banking Activity */}
      <BankAccountsCard
        accounts={bankAccounts}
        getActivity={getActivity}
        upsertBankBalance={upsertBankBalance}
        onNavigate={() => onNavigate("accounts")}
        onSync={triggerSync}
        syncing={syncing}
      />

      {/* 5. Cash & Penny's Queue */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CashCard data={data} onNavigate={onNavigate} />
        <PennyQueueCard onNavigate={onNavigate} />
      </div>
    </div>
  );
}

AccountingDashboard.displayName = "AccountingDashboard";
