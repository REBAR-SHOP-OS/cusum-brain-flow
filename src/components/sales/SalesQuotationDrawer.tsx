import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Trash2, Plus, Copy, Send, CheckCircle, XCircle, AlertTriangle,
  Clock, FileText, Eye, RotateCcw, Ban, ChevronDown, History, Mail, Loader2,
} from "lucide-react";
import { SalesQuotation, getStatusInfo, getAvailableTransitions, canTransitionTo } from "@/hooks/useSalesQuotations";
import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  sort_order: number;
}

interface AuditEntry {
  id: string;
  event_type: string;
  previous_value: string | null;
  new_value: string | null;
  performed_by_name: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface Props {
  quotation: SalesQuotation | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (data: Partial<SalesQuotation> & { id: string }) => void;
  onDelete: (id: string) => void;
  onDuplicate: (q: SalesQuotation) => void;
}

// Transition button config: map target status to UI config
const TRANSITION_BUTTONS: Record<string, { label: string; icon: any; variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" }> = {
  pricing_in_progress:          { label: "Start Pricing", icon: Clock, variant: "default" },
  quote_ready:                  { label: "Mark Ready", icon: CheckCircle, variant: "default" },
  pricing_failed:               { label: "Mark Failed", icon: AlertTriangle, variant: "destructive" },
  awaiting_internal_review:     { label: "Submit for Review", icon: Eye, variant: "default" },
  internally_approved:          { label: "Approve", icon: CheckCircle, variant: "default" },
  internal_revision_requested:  { label: "Request Revision", icon: RotateCcw, variant: "outline" },
  sent_to_customer:             { label: "Send to Customer", icon: Send, variant: "default" },
  customer_approved:            { label: "Customer Approved", icon: CheckCircle, variant: "default" },
  customer_revision_requested:  { label: "Customer Revision", icon: RotateCcw, variant: "outline" },
  customer_rejected:            { label: "Customer Rejected", icon: XCircle, variant: "destructive" },
  draft:                        { label: "Back to Draft", icon: RotateCcw, variant: "outline" },
  expired:                      { label: "Mark Expired", icon: Clock, variant: "secondary" },
  cancelled:                    { label: "Cancel", icon: Ban, variant: "destructive" },
  // Legacy
  sent:                         { label: "Mark Sent", icon: Send, variant: "default" },
  accepted:                     { label: "Accepted", icon: CheckCircle, variant: "default" },
  declined:                     { label: "Declined", icon: XCircle, variant: "destructive" },
};

export default function SalesQuotationDrawer({ quotation, open, onClose, onUpdate, onDelete, onDuplicate }: Props) {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();
  const [items, setItems] = useState<LineItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [notes, setNotes] = useState("");
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDialogAction, setEmailDialogAction] = useState<"send_quote" | "convert_to_invoice">("send_quote");
  const [customerEmail, setCustomerEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (quotation) {
      setNotes(quotation.notes || "");
      loadItems(quotation.id);
      setShowAudit(false);
    }
  }, [quotation?.id]);

  const loadItems = async (qId: string) => {
    setLoadingItems(true);
    const { data } = await supabase
      .from("sales_quotation_items" as any)
      .select("*")
      .eq("quotation_id", qId)
      .order("sort_order");
    setItems((data as any[] || []).map((d: any) => ({ ...d, total: d.quantity * d.unit_price })));
    setLoadingItems(false);
  };

  const loadAudit = async () => {
    if (!quotation) return;
    const { data } = await supabase
      .from("quote_audit_log")
      .select("*")
      .eq("quotation_id", quotation.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setAuditLog((data as AuditEntry[]) || []);
    setShowAudit(true);
  };

  const addItem = async () => {
    if (!quotation || !companyId) return;
    const { data, error } = await supabase
      .from("sales_quotation_items" as any)
      .insert({ quotation_id: quotation.id, company_id: companyId, description: "", quantity: 1, unit: "ea", unit_price: 0, sort_order: items.length } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setItems(prev => [...prev, { ...(data as any), total: 0 }]);
  };

  const updateItem = async (id: string, field: string, value: any) => {
    await supabase.from("sales_quotation_items" as any).update({ [field]: value } as any).eq("id", id);
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value, total: field === "quantity" ? value * it.unit_price : field === "unit_price" ? it.quantity * value : it.total } : it));
  };

  const removeItem = async (id: string) => {
    await supabase.from("sales_quotation_items" as any).delete().eq("id", id);
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const itemsTotal = items.reduce((s, it) => s + (it.quantity * it.unit_price), 0);

  if (!quotation) return null;

  const statusInfo = getStatusInfo(quotation.status);
  const transitions = getAvailableTransitions(quotation.status);
  const isPricingFailed = quotation.pricing_status === "failed" || quotation.status === "pricing_failed";
  const isLocked = ["customer_approved", "cancelled"].includes(quotation.status);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        <div className="p-4">
          <SheetHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <SheetTitle className="text-left font-mono">{quotation.quotation_number}</SheetTitle>
              <Badge className={cn("text-[11px]", statusInfo.color)}>{statusInfo.label}</Badge>
              {quotation.version_number > 1 && (
                <Badge variant="outline" className="text-[10px]">V{quotation.version_number}</Badge>
              )}
            </div>
          </SheetHeader>
        </div>

        <ScrollArea className="h-[calc(100vh-80px)] px-4 pb-6">
          <div className="space-y-4">
            {/* Pricing failure alert */}
            {isPricingFailed && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Pricing Failed</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {quotation.pricing_failure_reason || "Unknown pricing failure. Review inputs and retry."}
                    </p>
                    {quotation.pricing_failure_details && (
                      <details className="mt-2">
                        <summary className="text-[10px] text-muted-foreground cursor-pointer">Technical Details</summary>
                        <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap break-all">
                          {JSON.stringify(quotation.pricing_failure_details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* $0 amount warning */}
            {quotation.status !== "draft" && quotation.status !== "pricing_in_progress" && (!quotation.amount || quotation.amount <= 0) && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
                  <p className="text-xs text-yellow-700">⚠ Quote amount is $0. This quote cannot be approved until pricing succeeds.</p>
                </div>
              </div>
            )}

            {/* Status transitions */}
            {transitions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {transitions
                  .filter(t => t !== "cancelled") // Show cancel separately
                  .map(targetStatus => {
                    const btn = TRANSITION_BUTTONS[targetStatus];
                    if (!btn) return null;
                    const Icon = btn.icon;
                    return (
                      <Button
                        key={targetStatus}
                        size="sm"
                        variant={btn.variant || "default"}
                        onClick={() => onUpdate({ id: quotation.id, status: targetStatus })}
                        className="text-xs h-8"
                      >
                        <Icon className="w-3.5 h-3.5 mr-1" />{btn.label}
                      </Button>
                    );
                  })}
              </div>
            )}

            {/* Customer info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Customer Name</Label>
                <Input
                  defaultValue={quotation.customer_name || ""}
                  className="h-9"
                  disabled={isLocked}
                  onBlur={(e) => onUpdate({ id: quotation.id, customer_name: e.target.value || null })}
                />
              </div>
              <div>
                <Label className="text-xs">Company</Label>
                <Input
                  defaultValue={quotation.customer_company || ""}
                  className="h-9"
                  disabled={isLocked}
                  onBlur={(e) => onUpdate({ id: quotation.id, customer_company: e.target.value || null })}
                />
              </div>
            </div>

            {/* Pricing details */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Amount</Label>
                <p className={cn("text-lg font-bold mt-1", quotation.amount && quotation.amount > 0 ? "text-primary" : "text-destructive")}>
                  $ {(quotation.amount || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-xs">Tonnage</Label>
                <p className="text-sm font-medium mt-1 text-foreground">
                  {quotation.total_tonnage ? `${Number(quotation.total_tonnage).toFixed(2)} t` : "—"}
                </p>
              </div>
              <div>
                <Label className="text-xs">Bracket</Label>
                <p className="text-xs text-muted-foreground mt-2">{quotation.tonnage_bracket || "—"}</p>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Expiry Date</Label>
                <Input
                  type="date"
                  defaultValue={quotation.expiry_date || ""}
                  className="h-9"
                  disabled={isLocked}
                  onBlur={(e) => onUpdate({ id: quotation.id, expiry_date: e.target.value || null })}
                />
              </div>
              <div>
                <Label className="text-xs">Valid Until</Label>
                <Input
                  type="date"
                  defaultValue={quotation.valid_until || ""}
                  className="h-9"
                  disabled={isLocked}
                  onBlur={(e) => onUpdate({ id: quotation.id, valid_until: e.target.value || null })}
                />
              </div>
            </div>

            {/* Approval status summary */}
            {(quotation.internal_approved_at || quotation.customer_approved_at) && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Approval Status</p>
                {quotation.internal_approved_at && (
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    <span>Internal: Approved {format(new Date(quotation.internal_approved_at), "MMM d, yyyy h:mm a")}</span>
                  </div>
                )}
                {quotation.internal_approval_note && (
                  <p className="text-[10px] text-muted-foreground ml-5">{quotation.internal_approval_note}</p>
                )}
                {quotation.pdf_viewed_internally && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Eye className="w-3 h-3" />
                    <span>PDF viewed internally</span>
                  </div>
                )}
                {quotation.customer_approved_at && (
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    <span>Customer: Approved {format(new Date(quotation.customer_approved_at), "MMM d, yyyy h:mm a")}</span>
                    {quotation.customer_approved_by && <span className="text-muted-foreground">by {quotation.customer_approved_by}</span>}
                  </div>
                )}
                {quotation.pdf_viewed_by_customer && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Eye className="w-3 h-3" />
                    <span>PDF viewed by customer (V{quotation.customer_approval_version || quotation.version_number})</span>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Line Items</p>
                {!isLocked && (
                  <Button size="sm" variant="ghost" onClick={addItem} className="h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" />Add Item
                  </Button>
                )}
              </div>
              {loadingItems ? (
                <p className="text-xs text-muted-foreground animate-pulse">Loading...</p>
              ) : items.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 py-4 text-center">No line items — click Add Item</p>
              ) : (
                <div className="space-y-1.5">
                  {items.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_60px_60px_70px_28px] gap-1.5 items-center">
                      <Input
                        defaultValue={item.description}
                        placeholder="Description"
                        className="h-7 text-xs"
                        disabled={isLocked}
                        onBlur={(e) => updateItem(item.id, "description", e.target.value)}
                      />
                      <Input
                        type="number"
                        defaultValue={item.quantity}
                        className="h-7 text-xs text-center"
                        disabled={isLocked}
                        onBlur={(e) => updateItem(item.id, "quantity", Number(e.target.value) || 0)}
                      />
                      <Input
                        type="number"
                        defaultValue={item.unit_price}
                        className="h-7 text-xs text-right"
                        disabled={isLocked}
                        onBlur={(e) => updateItem(item.id, "unit_price", Number(e.target.value) || 0)}
                      />
                      <span className="text-xs text-right font-medium">$ {(item.quantity * item.unit_price).toLocaleString()}</span>
                      {!isLocked && (
                        <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-end pt-1 border-t border-border/50">
                    <span className="text-sm font-bold">Total: $ {itemsTotal.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Notes */}
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isLocked}
                onBlur={() => { if (notes !== (quotation.notes || "")) onUpdate({ id: quotation.id, notes: notes || null }); }}
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Revision reason */}
            {quotation.revision_reason && (
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                <p className="text-xs font-medium text-orange-600">Revision Reason</p>
                <p className="text-xs text-muted-foreground mt-1">{quotation.revision_reason}</p>
              </div>
            )}

            <Separator />

            {/* Audit trail */}
            <div>
              <Button variant="ghost" size="sm" onClick={loadAudit} className="h-7 text-xs w-full justify-start">
                <History className="w-3 h-3 mr-1" />
                {showAudit ? "Refresh Audit Trail" : "Show Audit Trail"}
                <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", showAudit && "rotate-180")} />
              </Button>
              {showAudit && (
                <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                  {auditLog.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 text-center py-2">No audit entries yet</p>
                  ) : auditLog.map(entry => (
                    <div key={entry.id} className="flex items-start gap-2 text-[10px] text-muted-foreground py-1 border-b border-border/30 last:border-0">
                      <span className="shrink-0 font-mono">{format(new Date(entry.created_at), "MMM d HH:mm")}</span>
                      <span className="font-medium text-foreground">{entry.event_type}</span>
                      {entry.previous_value && entry.new_value && (
                        <span>{entry.previous_value} → {entry.new_value}</span>
                      )}
                      {entry.notes && <span className="italic">{entry.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { onDuplicate(quotation); onClose(); }}>
                  <Copy className="w-3.5 h-3.5 mr-1" />Duplicate
                </Button>
                {transitions.includes("cancelled") && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onUpdate({ id: quotation.id, status: "cancelled" })}>
                    <Ban className="w-3.5 h-3.5 mr-1" />Cancel
                  </Button>
                )}
              </div>
              <Button variant="destructive" size="sm" onClick={() => { onDelete(quotation.id); onClose(); }}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
              </Button>
            </div>

            <div className="text-[10px] text-muted-foreground space-y-0.5 pb-4">
              <p>Created: {format(new Date(quotation.created_at), "MMM d, yyyy h:mm a")}</p>
              {quotation.updated_at && <p>Updated: {format(new Date(quotation.updated_at), "MMM d, yyyy h:mm a")}</p>}
              <p>Source: {quotation.source || "manual"} • Version: V{quotation.version_number}</p>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
