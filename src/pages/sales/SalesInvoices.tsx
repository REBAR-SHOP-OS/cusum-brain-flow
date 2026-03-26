import { useState, useMemo } from "react";
import { useSalesInvoices, SalesInvoice } from "@/hooks/useSalesInvoices";
import { Button } from "@/components/ui/button";
import { Plus, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, isPast } from "date-fns";
import SalesSearchBar from "@/components/sales/SalesSearchBar";
import SalesSummaryCards, { SummaryCardData } from "@/components/sales/SalesSummaryCards";
import { DraftInvoiceEditor } from "@/components/accounting/documents/DraftInvoiceEditor";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export default function SalesInvoices() {
  const { invoices, isLoading, generateNumber } = useSalesInvoices();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState("");
  const [editorInvoiceId, setEditorInvoiceId] = useState<string | null>(null);

  const getDisplayStatus = (inv: SalesInvoice) => {
    if (inv.status === "sent" && inv.due_date && isPast(new Date(inv.due_date))) return "overdue";
    return inv.status;
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(inv =>
      inv.invoice_number.toLowerCase().includes(q) ||
      (inv.customer_name || "").toLowerCase().includes(q) ||
      (inv.customer_company || "").toLowerCase().includes(q) ||
      inv.status.toLowerCase().includes(q)
    );
  }, [invoices, search]);

  const outstanding = invoices.filter(i => i.status === "sent" || i.status === "draft").reduce((s, i) => s + (i.amount || 0), 0);
  const paidTotal = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.amount || 0), 0);
  const overdueCount = invoices.filter(i => getDisplayStatus(i) === "overdue").length;

  const summaryCards: SummaryCardData[] = [
    { label: "Outstanding", value: `$ ${outstanding.toLocaleString()}`, color: "text-blue-500" },
    { label: "Paid", value: `$ ${paidTotal.toLocaleString()}`, color: "text-green-500" },
    { label: "Overdue", value: overdueCount, color: overdueCount > 0 ? "text-destructive" : undefined },
    { label: "Total", value: invoices.length },
  ];

  const handleNewInvoice = async () => {
    if (!companyId) return;
    const num = await generateNumber();
    const { data, error } = await supabase
      .from("sales_invoices")
      .insert({
        invoice_number: num,
        company_id: companyId,
        status: "draft",
        issued_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditorInvoiceId(data.id);
  };

  if (editorInvoiceId) {
    return (
      <DraftInvoiceEditor
        invoiceId={editorInvoiceId}
        onClose={() => setEditorInvoiceId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-3">
        <h1 className="text-lg font-semibold text-foreground shrink-0">Invoices</h1>
        <div className="flex-1 max-w-xs">
          <SalesSearchBar value={search} onChange={setSearch} placeholder="Search invoices..." />
        </div>
        <Button size="sm" onClick={handleNewInvoice}><Plus className="w-4 h-4 mr-1" />New Invoice</Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <SalesSummaryCards cards={summaryCards} />

        {isLoading ? (
          <div className="animate-pulse text-muted-foreground text-center py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Receipt className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">{search ? "No matching invoices" : "No invoices yet"}</p>
            {!search && <Button variant="outline" size="sm" className="mt-3" onClick={handleNewInvoice}>Create First Invoice</Button>}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(inv => {
                const ds = getDisplayStatus(inv);
                return (
                  <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setEditorInvoiceId(inv.id)}>
                    <TableCell className="font-medium font-mono">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.customer_name || inv.customer_company || "—"}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[ds] || ""}>{ds}</Badge></TableCell>
                    <TableCell className="text-right">{inv.amount ? `$ ${Number(inv.amount).toLocaleString()}` : "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{inv.issued_date ? format(new Date(inv.issued_date), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
