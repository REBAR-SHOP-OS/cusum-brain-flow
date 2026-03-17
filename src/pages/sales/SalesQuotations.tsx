import { useState, useEffect, useCallback, useMemo } from "react";
import { useSalesQuotations, SalesQuotation, generateQuotationNumber } from "@/hooks/useSalesQuotations";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import TakeoffWizard from "@/components/estimation/TakeoffWizard";
import SalesSearchBar from "@/components/sales/SalesSearchBar";
import SalesSummaryCards, { SummaryCardData } from "@/components/sales/SalesSummaryCards";
import SalesQuotationDrawer from "@/components/sales/SalesQuotationDrawer";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  declined: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  expired: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

export default function SalesQuotations() {
  const { quotations, isLoading, create, update, remove, generateNumber } = useSalesQuotations();
  const { companyId } = useCompanyId();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ quotation_number: "", customer_name: "", customer_company: "", amount: "", expiry_date: "", notes: "" });
  const [search, setSearch] = useState("");
  const [drawerQuotation, setDrawerQuotation] = useState<SalesQuotation | null>(null);

  // Drag-and-drop + TakeoffWizard state
  const [dragOver, setDragOver] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);

  useEffect(() => {
    if (createOpen) {
      generateNumber().then((num) => setForm((p) => ({ ...p, quotation_number: num })));
    }
  }, [createOpen]);

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return quotations;
    const q = search.toLowerCase();
    return quotations.filter(qo =>
      qo.quotation_number.toLowerCase().includes(q) ||
      (qo.customer_name || "").toLowerCase().includes(q) ||
      (qo.customer_company || "").toLowerCase().includes(q) ||
      qo.status.toLowerCase().includes(q)
    );
  }, [quotations, search]);

  // Summary
  const draftValue = quotations.filter(q => q.status === "draft").reduce((s, q) => s + (q.amount || 0), 0);
  const sentValue = quotations.filter(q => q.status === "sent").reduce((s, q) => s + (q.amount || 0), 0);
  const accepted = quotations.filter(q => q.status === "accepted").length;
  const total = quotations.length;
  const convRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
  const avgSize = total > 0 ? Math.round(quotations.reduce((s, q) => s + (q.amount || 0), 0) / total) : 0;

  const summaryCards: SummaryCardData[] = [
    { label: "Draft Value", value: `$ ${draftValue.toLocaleString()}` },
    { label: "Sent Value", value: `$ ${sentValue.toLocaleString()}`, color: "text-blue-500" },
    { label: "Conversion", value: `${convRate}%`, sub: `${accepted}/${total}` },
    { label: "Avg Size", value: avgSize > 0 ? `$ ${avgSize.toLocaleString()}` : "—" },
  ];

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

  const handleDuplicate = async (q: SalesQuotation) => {
    const newNum = await generateNumber();
    create.mutate({
      quotation_number: newNum,
      customer_name: q.customer_name,
      customer_company: q.customer_company,
      amount: q.amount,
      expiry_date: null,
      notes: q.notes,
    });
    toast.success("Quotation duplicated");
  };

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => /\.(pdf|png|jpg|jpeg|tif|tiff|xls|xlsx|csv)$/i.test(f.name));
    if (files.length) { setDroppedFiles(files); setWizardOpen(true); }
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-3">
        <h1 className="text-lg font-semibold text-foreground shrink-0">Quotations</h1>
        <div className="flex-1 max-w-xs">
          <SalesSearchBar value={search} onChange={setSearch} placeholder="Search quotations..." />
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" />New Quotation</Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <SalesSummaryCards cards={summaryCards} />

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mb-4 border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-muted-foreground/40"
          }`}
        >
          <Upload className={`w-4 h-4 mx-auto mb-1 ${dragOver ? "text-primary" : "text-muted-foreground/50"}`} />
          <p className="text-xs text-muted-foreground">Drop estimation files to auto-generate quotation</p>
        </div>

        {isLoading ? (
          <div className="animate-pulse text-muted-foreground text-center py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">{search ? "No matching quotations" : "No quotations yet"}</p>
            {!search && <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>Create First Quotation</Button>}
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
              {filtered.map(q => (
                <TableRow key={q.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDrawerQuotation(q)}>
                  <TableCell className="font-medium font-mono">{q.quotation_number}</TableCell>
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

      {/* Manual create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Quotation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Quotation Number *</Label><Input value={form.quotation_number} onChange={e => setForm(p => ({ ...p, quotation_number: e.target.value }))} placeholder="Q20260001" className="font-mono" /></div>
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

      {/* Quotation detail drawer */}
      <SalesQuotationDrawer
        quotation={drawerQuotation}
        open={!!drawerQuotation}
        onClose={() => setDrawerQuotation(null)}
        onUpdate={(data) => { update.mutate(data); setDrawerQuotation(prev => prev ? { ...prev, ...data } : null); }}
        onDelete={(id) => remove.mutate(id)}
        onDuplicate={handleDuplicate}
      />

      <TakeoffWizard
        open={wizardOpen}
        onClose={() => { setWizardOpen(false); setDroppedFiles([]); }}
        onComplete={() => { setWizardOpen(false); setDroppedFiles([]); }}
        initialFiles={droppedFiles}
      />
    </div>
  );
}
