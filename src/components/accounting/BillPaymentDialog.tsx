import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorQbId?: string;
  vendorName?: string;
  bills?: { Id: string; DocNumber?: string; Balance: number; TxnDate?: string }[];
  onCreated?: () => void;
}

export function BillPaymentDialog({ open, onOpenChange, vendorQbId, vendorName, bills = [], onCreated }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState("");
  const [amount, setAmount] = useState("");
  const [payType, setPayType] = useState<"Check" | "CreditCard">("Check");
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split("T")[0]);

  const selectedBill = bills.find(b => b.Id === selectedBillId);

  const handleSave = async () => {
    if (!selectedBillId || !amount || !vendorQbId) {
      toast({ title: "Missing fields", description: "Select a bill and enter an amount", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const billPayment = {
        VendorRef: { value: vendorQbId },
        PayType: payType,
        TotalAmt: parseFloat(amount),
        TxnDate: txnDate,
        Line: [
          {
            Amount: parseFloat(amount),
            LinkedTxn: [{ TxnId: selectedBillId, TxnType: "Bill" }],
          },
        ],
        ...(payType === "Check"
          ? { CheckPayment: { BankAccountRef: {} } }
          : { CreditCardPayment: { CCAccountRef: {} } }),
      };

      const { error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "create-bill-payment", billPayment },
      });
      if (error) throw error;
      toast({ title: "Bill payment created in QuickBooks" });
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast({ title: "Failed to create bill payment", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pay Bill — {vendorName || "Vendor"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Select Bill</Label>
            <Select value={selectedBillId} onValueChange={v => {
              setSelectedBillId(v);
              const bill = bills.find(b => b.Id === v);
              if (bill) setAmount(String(bill.Balance));
            }}>
              <SelectTrigger><SelectValue placeholder="Choose a bill..." /></SelectTrigger>
              <SelectContent>
                {bills.filter(b => b.Balance > 0).map(b => (
                  <SelectItem key={b.Id} value={b.Id}>
                    #{b.DocNumber || b.Id} — ${b.Balance.toFixed(2)} ({b.TxnDate || "N/A"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={payType} onValueChange={v => setPayType(v as "Check" | "CreditCard")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Check">Check / Bank</SelectItem>
                  <SelectItem value="CreditCard">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} />
          </div>
          {selectedBill && (
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              Bill Balance: <strong>${selectedBill.Balance.toFixed(2)}</strong>
              {parseFloat(amount) > selectedBill.Balance && (
                <span className="text-destructive ml-2">⚠️ Amount exceeds balance</span>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Pay Bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
