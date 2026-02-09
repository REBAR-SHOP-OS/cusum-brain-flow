import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Receipt, Landmark, DollarSign,
  Plus, AlertTriangle, MoreVertical, PiggyBank, Wallet,
} from "lucide-react";
import type { QBAccount } from "@/hooks/useQuickBooksData";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";
import { useMemo } from "react";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
  onNavigate: (tab: string) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

/** Simple mini bar chart for due-date distribution */
function MiniBarChart({ data }: { data: { label: string; value: number; highlight?: boolean }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1.5 h-14 mt-3">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <div
            className={`w-full rounded-sm min-h-[4px] transition-all ${
              d.highlight ? "bg-primary" : "bg-muted-foreground/20"
            }`}
            style={{ height: `${Math.max((d.value / max) * 48, 4)}px` }}
          />
          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function InvoicesCard({ data, onNavigate }: Props) {
  const { invoices, overdueInvoices, totalReceivable } = data;
  const unpaid = invoices.filter((i) => i.Balance > 0);
  const unpaidTotal = unpaid.reduce((s, i) => s + i.Balance, 0);
  const lateTotal = overdueInvoices.reduce((s, i) => s + i.Balance, 0);

  const now = new Date();
  const weekMs = 7 * 86400000;
  const dueBuckets = useMemo(() => {
    const buckets = [
      { label: "Overdue", value: 0, highlight: false },
      { label: "This Week", value: 0, highlight: true },
      { label: "Next Week", value: 0, highlight: false },
      { label: "Later", value: 0, highlight: false },
      { label: "Not Due", value: 0, highlight: false },
    ];
    invoices.forEach((inv) => {
      if (inv.Balance <= 0) return;
      const due = new Date(inv.DueDate);
      const diff = due.getTime() - now.getTime();
      if (diff < 0) buckets[0].value++;
      else if (diff < weekMs) buckets[1].value++;
      else if (diff < weekMs * 2) buckets[2].value++;
      else if (diff < weekMs * 4) buckets[3].value++;
      else buckets[4].value++;
    });
    return buckets;
  }, [invoices]);

  return (
    <Card className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => onNavigate("invoices")}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-primary">Customer Invoices</h3>
          </div>
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        <Button size="sm" variant="default" className="text-xs mb-3 gap-1.5" onClick={(e) => { e.stopPropagation(); onNavigate("invoices"); }}>
          <Plus className="w-3 h-3" /> New Invoice
        </Button>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{invoices.length} Invoices Total</span>
            <span className="font-semibold tabular-nums">{fmt(totalReceivable)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-primary">{unpaid.length} Unpaid Invoices</span>
            <span className="font-semibold tabular-nums text-primary">{fmt(unpaidTotal)}</span>
          </div>
          {overdueInvoices.length > 0 && (
            <div className="flex justify-between">
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {overdueInvoices.length} Late Invoices
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

function BillsCard({ data, onNavigate }: Props) {
  const { bills, overdueBills, totalPayable } = data;
  const unpaid = bills.filter((b) => b.Balance > 0);

  const now = new Date();
  const weekMs = 7 * 86400000;
  const dueBuckets = useMemo(() => {
    const buckets = [
      { label: "Overdue", value: 0, highlight: false },
      { label: "This Week", value: 0, highlight: true },
      { label: "Next Week", value: 0, highlight: false },
      { label: "Later", value: 0, highlight: false },
      { label: "Not Due", value: 0, highlight: false },
    ];
    bills.forEach((b) => {
      if (b.Balance <= 0) return;
      const due = new Date(b.DueDate);
      const diff = due.getTime() - now.getTime();
      if (diff < 0) buckets[0].value++;
      else if (diff < weekMs) buckets[1].value++;
      else if (diff < weekMs * 2) buckets[2].value++;
      else if (diff < weekMs * 4) buckets[3].value++;
      else buckets[4].value++;
    });
    return buckets;
  }, [bills]);

  return (
    <Card className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => onNavigate("bills")}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-primary">Vendor Bills</h3>
          </div>
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-primary">{unpaid.length} Bills to Pay</span>
            <span className="font-semibold tabular-nums">{fmt(totalPayable)}</span>
          </div>
          {overdueBills.length > 0 && (
            <div className="flex justify-between">
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {overdueBills.length} Overdue
              </span>
              <span className="font-semibold tabular-nums text-destructive">
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

function BankAccountCard({
  name,
  balance,
  icon = "checking",
  subAccounts,
  onNavigate,
}: {
  name: string;
  balance: number;
  icon?: "checking" | "savings";
  subAccounts?: QBAccount[];
  onNavigate: () => void;
}) {
  const Icon = icon === "savings" ? PiggyBank : Wallet;
  const accentColor = icon === "savings" ? "text-emerald-500" : "text-primary";

  return (
    <Card className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={onNavigate}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${accentColor}`} />
            <h3 className={`font-semibold text-sm ${accentColor}`}>{name}</h3>
          </div>
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Balance</span>
          <span className="font-semibold tabular-nums text-lg">{fmt(balance)}</span>
        </div>

        {subAccounts && subAccounts.length > 1 && (
          <div className="space-y-1 mt-2 border-t pt-2">
            {subAccounts.map((a) => (
              <div key={a.Id} className="flex justify-between text-xs text-muted-foreground">
                <span className="truncate mr-2">{a.Name}</span>
                <span className="tabular-nums font-medium">{fmt(a.CurrentBalance)}</span>
              </div>
            ))}
          </div>
        )}

        <Button size="sm" variant="outline" className={`text-xs mt-2 ${accentColor}`} onClick={(e) => { e.stopPropagation(); onNavigate(); }}>
          View Transactions
        </Button>
      </CardContent>
    </Card>
  );
}

function CashCard({ data, onNavigate }: Props) {
  const totalPayments = data.payments.reduce((s, p) => s + p.TotalAmt, 0);

  return (
    <Card className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => onNavigate("payments")}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-primary">Cash</h3>
          </div>
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        <Button size="sm" variant="default" className="text-xs mb-3 gap-1.5" onClick={(e) => { e.stopPropagation(); onNavigate("payments"); }}>
          <Plus className="w-3 h-3" /> New Transaction
        </Button>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-primary">Payments</span>
            <span className="font-semibold tabular-nums">{fmt(totalPayments)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountingDashboard({ data, onNavigate }: Props) {
  // Separate checking and savings accounts (filter by Bank type for safety)
  const bankAccounts = data.accounts.filter((a) => a.AccountType === "Bank" && a.Active);
  const checkingAccounts = bankAccounts.filter((a) => a.AccountSubType !== "Savings");
  const savingsAccounts = bankAccounts.filter((a) => a.AccountSubType === "Savings");

  const totalChecking = checkingAccounts.reduce((s, a) => s + a.CurrentBalance, 0);
  const totalSavings = savingsAccounts.reduce((s, a) => s + a.CurrentBalance, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <InvoicesCard data={data} onNavigate={onNavigate} />
      <BillsCard data={data} onNavigate={onNavigate} />

      {/* Checking Accounts */}
      <BankAccountCard
        name={checkingAccounts.length === 1 ? checkingAccounts[0].Name : "Checking"}
        balance={checkingAccounts.length === 1 ? checkingAccounts[0].CurrentBalance : totalChecking}
        icon="checking"
        subAccounts={checkingAccounts.length > 1 ? checkingAccounts : undefined}
        onNavigate={() => onNavigate("accounts")}
      />

      {/* Savings Accounts */}
      <BankAccountCard
        name={savingsAccounts.length === 1 ? savingsAccounts[0].Name : "Savings"}
        balance={savingsAccounts.length === 1 ? savingsAccounts[0].CurrentBalance : totalSavings}
        icon="savings"
        subAccounts={savingsAccounts.length > 1 ? savingsAccounts : undefined}
        onNavigate={() => onNavigate("accounts")}
      />

      <CashCard data={data} onNavigate={onNavigate} />
    </div>
  );
}
