import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, CheckCircle, Layers, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

type BatchOp = "send-invoices" | "approve-bills" | "void-invoices";

export function AccountingBatchActions({ data }: Props) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [activeOp, setActiveOp] = useState<BatchOp>("send-invoices");
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);

  const openInvoices = data.invoices.filter(i => {
    const bal = (i as any).Balance ?? 0;
    return bal > 0;
  });
  const unpaidBills = data.bills.filter(b => {
    const bal = (b as any).Balance ?? 0;
    return bal > 0;
  });

  const items = activeOp === "send-invoices" || activeOp === "void-invoices" ? openInvoices : unpaidBills;

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => (i as any).Id)));
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const executeBatch = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    setResults(null);
    let success = 0, failed = 0;

    for (const id of selectedIds) {
      try {
        const { error } = await supabase.functions.invoke("quickbooks-oauth", {
          body: { action: `batch-${activeOp}`, entityId: id },
        });
        if (error) throw error;
        success++;
      } catch {
        failed++;
      }
    }

    setResults({ success, failed });
    setSelectedIds(new Set());
    setProcessing(false);
    toast({
      title: "Batch complete",
      description: `${success} succeeded, ${failed} failed`,
      variant: failed > 0 ? "destructive" : "default",
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2"><Layers className="w-5 h-5" /> Batch Actions</h2>

      <div className="flex gap-2">
        {(["send-invoices", "approve-bills", "void-invoices"] as BatchOp[]).map(op => (
          <Button key={op} variant={activeOp === op ? "default" : "outline"} size="sm" onClick={() => { setActiveOp(op); setSelectedIds(new Set()); setResults(null); }}>
            {op === "send-invoices" ? "Send Invoices" : op === "approve-bills" ? "Approve Bills" : "Void Invoices"}
          </Button>
        ))}
      </div>

      {results && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <p className="text-sm">Batch completed: <strong>{results.success}</strong> succeeded, <strong>{results.failed}</strong> failed</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              {items.length} items · {selectedIds.size} selected
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {selectedIds.size === items.length ? "Deselect All" : "Select All"}
              </Button>
              <Button size="sm" disabled={selectedIds.size === 0 || processing} onClick={executeBatch} className="gap-2">
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Execute ({selectedIds.size})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No items available for this operation.</p>
          ) : items.map(item => {
            const id = (item as any).Id;
            const docNum = (item as any).DocNumber || id;
            const name = (item as any).CustomerRef?.name || (item as any).VendorRef?.name || "—";
            const bal = (item as any).Balance ?? 0;
            return (
              <div key={id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/50 cursor-pointer" onClick={() => toggle(id)}>
                <Checkbox checked={selectedIds.has(id)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">#{docNum} — {name}</p>
                </div>
                <span className="text-sm font-semibold shrink-0">{fmt(bal)}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
