import { useState } from "react";
import { useSalesQuotations, SalesQuotation } from "@/hooks/useSalesQuotations";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  declined: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  expired: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

export default function SalesQuotations() {
  const { quotations, isLoading, create, update, remove } = useSalesQuotations();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ quotation_number: "", customer_name: "", customer_company: "", amount: "", expiry_date: "", notes: "" });

  const handleCreate = () => {
    if (!form.quotation_number.trim()) return;
    create.mutate({
      quotation_number: form.quotation_number,
      customer_name: form.customer_name || null,
      customer_company: form.customer_company || null,
      amount: form.amount ? Number(form.amount) : null,
      expiry_date: form.expiry_date || null,
      notes: form.notes || null,
    });
    setCreateOpen(false);
    setForm({ quotation_number: "", customer_name: "", customer_company: "", amount: "", expiry_date: "", notes: "" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Quotations</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" />New Quotation</Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="animate-pulse text-muted-foreground text-center py-12">Loading...</div>
        ) : quotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No quotations yet</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>Create First Quotation</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expiry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map(q => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.quotation_number}</TableCell>
                  <TableCell>{q.customer_name || q.customer_company || "—"}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[q.status] || ""}>{q.status}</Badge></TableCell>
                  <TableCell className="text-right">{q.amount ? `$ ${Number(q.amount).toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{format(new Date(q.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{q.expiry_date ? format(new Date(q.expiry_date), "MMM d, yyyy") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Quotation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Quotation Number *</Label><Input value={form.quotation_number} onChange={e => setForm(p => ({ ...p, quotation_number: e.target.value }))} placeholder="Q-001" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Customer Name</Label><Input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} /></div>
              <div><Label>Company</Label><Input value={form.customer_company} onChange={e => setForm(p => ({ ...p, customer_company: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
              <div><Label>Expiry Date</Label><Input type="date" value={form.expiry_date} onChange={e => setForm(p => ({ ...p, expiry_date: e.target.value }))} /></div>
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={!form.quotation_number.trim()}>Create Quotation</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
