import { AlertTriangle } from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
  onNavigate: (tab: string) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export function AlertsBanner({ data, onNavigate }: Props) {
  const { overdueInvoices, overdueBills } = data;

  if (overdueInvoices.length === 0 && overdueBills.length === 0) return null;

  const overdueInvTotal = overdueInvoices.reduce((s, i) => s + i.Balance, 0);
  const overdueBillTotal = overdueBills.reduce((s, b) => s + b.Balance, 0);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
      <span className="text-sm font-medium text-destructive">Action Required</span>
      <div className="flex flex-wrap gap-3 ml-auto">
        {overdueInvoices.length > 0 && (
          <button
            onClick={() => onNavigate("invoices")}
            className="text-sm font-medium text-destructive hover:underline"
          >
            {overdueInvoices.length} overdue invoice{overdueInvoices.length !== 1 && "s"} ({fmt(overdueInvTotal)})
          </button>
        )}
        {overdueBills.length > 0 && (
          <button
            onClick={() => onNavigate("bills")}
            className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline"
          >
            {overdueBills.length} overdue bill{overdueBills.length !== 1 && "s"} ({fmt(overdueBillTotal)})
          </button>
        )}
      </div>
    </div>
  );
}

AlertsBanner.displayName = "AlertsBanner";
