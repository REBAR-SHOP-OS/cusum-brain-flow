import type { QBInvoice, QBBill, QBAccount, QBPayment } from "@/hooks/useQuickBooksData";

export function buildVizzyContext({
  totalReceivable,
  totalPayable,
  overdueInvoices,
  overdueBills,
  accounts,
  payments,
}: {
  totalReceivable: number;
  totalPayable: number;
  overdueInvoices: QBInvoice[];
  overdueBills: QBBill[];
  accounts: QBAccount[];
  payments: QBPayment[];
}): string {
  const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const bankAccounts = accounts
    .filter((a) => a.AccountType === "Bank" && a.Active)
    .map((a) => `  • ${a.Name}: ${fmt(a.CurrentBalance)}`)
    .join("\n");

  const topOverdueCustomers = overdueInvoices
    .slice(0, 5)
    .map((inv) => `  • ${inv.CustomerRef?.name}: ${fmt(inv.Balance)} (due ${inv.DueDate})`)
    .join("\n");

  const topOverdueVendors = overdueBills
    .slice(0, 5)
    .map((b) => `  • ${b.VendorRef?.name}: ${fmt(b.Balance)} (due ${b.DueDate})`)
    .join("\n");

  const recentPayments = payments
    .slice(0, 5)
    .map((p) => `  • ${p.CustomerRef?.name}: ${fmt(p.TotalAmt)} on ${p.TxnDate}`)
    .join("\n");

  const overdueInvTotal = overdueInvoices.reduce((s, i) => s + (i.Balance || 0), 0);
  const overdueBillTotal = overdueBills.reduce((s, b) => s + (b.Balance || 0), 0);

  return `LIVE FINANCIAL DATA (as of ${new Date().toLocaleString()}):
You have access to real business data. Use ONLY these numbers. NEVER make up or estimate financial figures.

ACCOUNTS RECEIVABLE: ${fmt(totalReceivable)}
ACCOUNTS PAYABLE: ${fmt(totalPayable)}

OVERDUE INVOICES: ${overdueInvoices.length} totaling ${fmt(overdueInvTotal)}
${topOverdueCustomers || "  None"}

OVERDUE BILLS: ${overdueBills.length} totaling ${fmt(overdueBillTotal)}
${topOverdueVendors || "  None"}

BANK ACCOUNTS:
${bankAccounts || "  No bank accounts found"}

RECENT PAYMENTS RECEIVED:
${recentPayments || "  None"}

If asked about data you don't have, say "I don't have that information right now" instead of guessing.`;
}
