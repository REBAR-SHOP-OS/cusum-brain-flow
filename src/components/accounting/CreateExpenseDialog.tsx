import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateExpenseDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    payeeName: "",
    accountId: "",
    paymentType: "Cash",
    amount: "",
    txnDate: new Date().toISOString().split("T")[0],
    memo: "",
    description: "",
  });

  const handleSave = async () => {
    if (!form.amount || !form.payeeName) {
      toast({ title: "Missing fields", description: "Payee and amount are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const purchase: Record<string, unknown> = {
        PaymentType: form.paymentType,
        TotalAmt: parseFloat(form.amount),
        TxnDate: form.txnDate,
        PrivateNote: form.memo || undefined,
        EntityRef: { name: form.payeeName, type: "Vendor" },
        Line: [
          {
            Amount: parseFloat(form.amount),
            DetailType: "AccountBasedExpenseLineDetail",
            Description: form.description || form.payeeName,
            AccountBasedExpenseLineDetail: {
              ...(form.accountId ? { AccountRef: { value: form.accountId } } : {}),
            },
          },
        ],
      };

      const { error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "create-purchase", purchase },
      });
      if (error) throw error;
      toast({ title: "Expense created in QuickBooks" });
      onOpenChange(false);
      onCreated?.();
      setForm({ payeeName: "", accountId: "", paymentType: "Cash", amount: "", txnDate: new Date().toISOString().split("T")[0], memo: "", description: "" });
    } catch (e: any) {
      toast({ title: "Failed to create expense", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Expense / Purchase</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Payee *</Label>
            <Input value={form.payeeName} onChange={e => setForm(f => ({ ...f, payeeName: e.target.value }))} placeholder="Vendor name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label>Payment Type</Label>
              <Select value={form.paymentType} onValueChange={v => setForm(f => ({ ...f, paymentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="CreditCard">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.txnDate} onChange={e => setForm(f => ({ ...f, txnDate: e.target.value }))} />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was purchased?" />
          </div>
          <div>
            <Label>Memo</Label>
            <Textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="Internal notes..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
