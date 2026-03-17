import { useState, useEffect, useCallback } from "react";
import { useSalesQuotations, SalesQuotation } from "@/hooks/useSalesQuotations";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import TakeoffWizard from "@/components/estimation/TakeoffWizard";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  declined: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  expired: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

export default function SalesQuotations() {
  const { quotations, isLoading, create, update, remove, generateNumber } = useSalesQuotations();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ quotation_number: "", customer_name: "", customer_company: "", amount: "", expiry_date: "", notes: "" });

  // Drag-and-drop + TakeoffWizard state
  const [dragOver, setDragOver] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);

  // Auto-generate quotation number when dialog opens
  useEffect(() => {
    if (createOpen) {
      generateNumber().then((num) => setForm((p) => ({ ...p, quotation_number: num })));
    }
  }, [createOpen]);

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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      /\.(pdf|png|jpg|jpeg|tif|tiff|xls|xlsx|csv)$/i.test(f.name)
    );
    if (files.length) {
      setDroppedFiles(files);
      setWizardOpen(true);
    }
  }, []);

  const handleWizardComplete = () => {
    setWizardOpen(false);
    setDroppedFiles([]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Quotations</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" />New Quotation</Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Drop zone — always visible at top when quotations exist */}
        {quotations.length > 0 && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`mb-4 border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/20 hover:border-muted-foreground/40"
            }`}
          >
            <Upload className={`w-5 h-5 mx-auto mb-1 ${dragOver ? "text-primary" : "text-muted-foreground/50"}`} />
            <p className="text-xs text-muted-foreground">Drop estimation files to auto-generate quotation</p>
          </div>
        )}

        {isLoading ? (
          <div className="animate-pulse text-muted-foreground text-center py-12">Loading...</div>
        ) : quotations.length === 0 ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/20"
            }`}
          >
            <Upload className={`w-12 h-12 mb-3 ${dragOver ? "text-primary" : "opacity-30 text-muted-foreground"}`} />
            <p className="text-sm text-muted-foreground font-medium">
              {dragOver ? "Drop to create quotation" : "Drop estimation drawings here"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">PDF · Spreadsheet · Image — auto-generates quotation</p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />Manual Quotation
              </Button>
            </div>
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

      {/* TakeoffWizard for drag-and-drop estimation */}
      <TakeoffWizard
        open={wizardOpen}
        onClose={() => { setWizardOpen(false); setDroppedFiles([]); }}
        onComplete={handleWizardComplete}
        initialFiles={droppedFiles}
      />
    </div>
  );
}
