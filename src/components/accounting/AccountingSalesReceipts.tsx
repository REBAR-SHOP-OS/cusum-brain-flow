import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Receipt, Search, Plus, Loader2, Eye } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";
import { DocumentUploadZone } from "./DocumentUploadZone";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

interface SalesReceipt {
  Id: string;
  DocNumber: string;
  CustomerRef?: { value: string; name: string };
  TotalAmt: number;
  TxnDate: string;
  Balance: number;
  PrivateNote?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingSalesReceipts({ data }: Props) {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<SalesReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<SalesReceipt | null>(null);

  // Create form state
  const [customerId, setCustomerId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "list-sales-receipts" },
      });
      if (error) {
        let msg = getErrorMessage(error);
        try {
          const body = await error.context?.json?.();
          if (body?.error) msg = body.error;
        } catch {
          try {
            const text = await error.context?.text?.();
            if (text) {
              const parsed = JSON.parse(text);
              if (parsed.error) msg = parsed.error;
            }
          } catch { /* use fallback */ }
        }
        toast({ title: "Error loading sales receipts", description: msg, variant: "destructive" });
        setLoading(false);
        return;
      }
      if (result?.error) {
        toast({ title: "Error loading sales receipts", description: result.error, variant: "destructive" });
        setLoading(false);
        return;
      }
      setReceipts(result?.salesReceipts || []);
    } catch (e: any) {
      toast({ title: "Error loading sales receipts", description: getErrorMessage(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReceipts(); }, []);

  const handleCreate = async () => {
    if (!customerId || !amount) return;
    setCreating(true);
    try {
      const customer = data.customers.find(c => c.Id === customerId);
      const { data: result, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: {
          action: "create-sales-receipt",
          customerId,
          customerName: customer?.DisplayName || "Customer",
          lineItems: [{ description: description || "Sales receipt", amount: parseFloat(amount) }],
          memo,
        },
      });
      if (error) {
        let msg = getErrorMessage(error);
        try {
          const body = await error.context?.json?.();
          if (body?.error) msg = body.error;
        } catch {
          try {
            const text = await error.context?.text?.();
            if (text) {
              const parsed = JSON.parse(text);
              if (parsed.error) msg = parsed.error;
            }
          } catch { /* use fallback */ }
        }
        toast({ title: "Error creating sales receipt", description: msg, variant: "destructive" });
        setCreating(false);
        return;
      }
      if (result?.error) {
        toast({ title: "Error creating sales receipt", description: result.error, variant: "destructive" });
        setCreating(false);
        return;
      }
      toast({ title: "Sales receipt created", description: `#${result?.docNumber}` });
      setShowCreate(false);
      setCustomerId(""); setDescription(""); setAmount(""); setMemo("");
      loadReceipts();
    } catch (e: any) {
      toast({ title: "Error creating sales receipt", description: getErrorMessage(e), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const sorted = [...receipts].sort((a, b) => new Date(b.TxnDate).getTime() - new Date(a.TxnDate).getTime());
  const filtered = sorted.filter(r =>
    (r.CustomerRef?.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.DocNumber || "").toLowerCase().includes(search.toLowerCase())
  );
  const total = receipts.reduce((s, r) => s + r.TotalAmt, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input placeholder="Search sales receipts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-12 text-base" />
        </div>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Receipt className="w-6 h-6 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Total Collected</p>
              <p className="text-xl font-bold text-emerald-600">{fmt(total)}</p>
            </div>
          </CardContent>
        </Card>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Sales Receipt
        </Button>
      </div>

      <DocumentUploadZone
        targetType="sales_receipt"
        onImport={(result) => {
          toast({ title: "Sales receipt imported", description: `${result.fields.length} fields extracted.` });
          loadReceipts();
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Sales Receipts ({filtered.length})
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              {loading ? "Loading..." : "No sales receipts found."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doc #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.Id}>
                    <TableCell className="font-medium">{r.DocNumber || "—"}</TableCell>
                    <TableCell>{r.CustomerRef?.name || "—"}</TableCell>
                    <TableCell>{new Date(r.TxnDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(r.TotalAmt)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => setSelectedReceipt(r)}>
                        <Eye className="w-4 h-4" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Sales Receipt</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Customer</Label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select customer...</option>
                {data.customers.map(c => <option key={c.Id} value={c.Id}>{c.DisplayName}</option>)}
              </select>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Item / service description" />
            </div>
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Memo (optional)</Label>
              <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Internal note..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !customerId || !amount}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales Receipt Detail Sheet */}
      <Sheet open={!!selectedReceipt} onOpenChange={(o) => { if (!o) setSelectedReceipt(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Sales Receipt #{selectedReceipt?.DocNumber}</SheetTitle>
            <SheetDescription>Full sales receipt details</SheetDescription>
          </SheetHeader>
          {selectedReceipt && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">Customer</p><p className="font-medium">{selectedReceipt.CustomerRef?.name || "—"}</p></div>
                <div><p className="text-sm text-muted-foreground">Date</p><p className="font-medium">{new Date(selectedReceipt.TxnDate).toLocaleDateString()}</p></div>
                <div><p className="text-sm text-muted-foreground">Amount</p><p className="font-semibold text-lg">{fmt(selectedReceipt.TotalAmt)}</p></div>
                <div><p className="text-sm text-muted-foreground">Memo</p><p className="font-medium">{selectedReceipt.PrivateNote || "—"}</p></div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
