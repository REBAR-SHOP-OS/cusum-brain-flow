import { useState } from "react";
import { useSalesInvoices } from "@/hooks/useSalesInvoices";
import { Button } from "@/components/ui/button";
import { Plus, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export default function SalesInvoices() {
  const { invoices, isLoading, create } = useSalesInvoices();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ invoice_number: "", customer_name: "", customer_company: "", amount: "", due_date: "", issued_date: "" });

  const handleCreate = () => {
    if (!form.invoice_number.trim()) return;
    create.mutate({
      invoice_number: form.invoice_number,
      customer_name: form.customer_name || null,
      customer_company: form.customer_company || null,
      amount: form.amount ? Number(form.amount) : null,
      due_date: form.due_date || null,
      issued_date: form.issued_date || null,
    });
    setCreateOpen(false);
    setForm({ invoice_number: "", customer_name: "", customer_company: "", amount: "", due_date: "", issued_date: "" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Invoices</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" />New Invoice</Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="animate-pulse text-muted-foreground text-center py-12">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Receipt className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No invoices yet</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>Create First Invoice</Button>
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
              {invoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.customer_name || inv.customer_company || "—"}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[inv.status] || ""}>{inv.status}</Badge></TableCell>
                  <TableCell className="text-right">{inv.amount ? `$ ${Number(inv.amount).toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{inv.issued_date ? format(new Date(inv.issued_date), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Invoice Number *</Label><Input value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} placeholder="INV-001" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Customer Name</Label><Input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} /></div>
              <div><Label>Company</Label><Input value={form.customer_company} onChange={e => setForm(p => ({ ...p, customer_company: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
              <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
            </div>
            <div><Label>Issued Date</Label><Input type="date" value={form.issued_date} onChange={e => setForm(p => ({ ...p, issued_date: e.target.value }))} /></div>
            <Button onClick={handleCreate} className="w-full" disabled={!form.invoice_number.trim()}>Create Invoice</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
