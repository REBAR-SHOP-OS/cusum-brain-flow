import { FileText, Receipt, Landmark, TrendingUp, TrendingDown } from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";
import type { QBAccount } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
  bankAccounts: QBAccount[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export function FinancialSnapshot({ data, bankAccounts }: Props) {
  const { totalReceivable, totalPayable } = data;
  const cashPosition = bankAccounts.reduce((s, a) => s + (a.CurrentBalance || 0), 0);
  const netPosition = totalReceivable - totalPayable;

  const tiles = [
    {
      label: "Receivable",
      value: totalReceivable,
      icon: FileText,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: "Payable",
      value: totalPayable,
      icon: Receipt,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-950/40",
    },
    {
      label: "Cash Position",
      value: cashPosition,
      icon: Landmark,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      label: "Net Position",
      value: netPosition,
      icon: netPosition >= 0 ? TrendingUp : TrendingDown,
      color: netPosition >= 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-destructive",
      bg: netPosition >= 0
        ? "bg-emerald-50 dark:bg-emerald-950/40"
        : "bg-destructive/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <div
          key={t.label}
          className={`rounded-xl p-4 ${t.bg} transition-colors`}
        >
          <div className="flex items-center gap-2 mb-2">
            <t.icon className={`w-4 h-4 ${t.color}`} />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t.label}
            </span>
          </div>
          <p className={`text-xl md:text-2xl font-bold tabular-nums ${t.color}`}>
            {fmt(t.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

FinancialSnapshot.displayName = "FinancialSnapshot";
