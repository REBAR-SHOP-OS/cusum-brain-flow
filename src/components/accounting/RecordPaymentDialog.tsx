import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amountDue: number;
  qbInvoiceId?: string;
  onSuccess: () => void;
  onClose: () => void;
}

const PAYMENT_METHODS = [
  { value: "Check", label: "Check" },
  { value: "CreditCard", label: "Credit Card" },
  { value: "Cash", label: "Cash" },
  { value: "ETransfer", label: "E-Transfer" },
  { value: "Wire", label: "Wire Transfer" },
];

export function RecordPaymentDialog({ invoiceId, invoiceNumber, customerName, amountDue, qbInvoiceId, onSuccess, onClose }: Props) {
  const [amount, setAmount] = useState(amountDue.toFixed(2));
  const [method, setMethod] = useState("Check");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: {
          action: "receive-payment",
          qbInvoiceId: qbInvoiceId || undefined,
          erpInvoiceId: invoiceId,
          invoiceNumber,
          customerName,
          amount: parsedAmount,
          paymentMethod: method,
          referenceNumber: reference || undefined,
          paymentDate,
          memo: memo || undefined,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success(`Payment of $${parsedAmount.toFixed(2)} recorded`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center print:hidden" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-[420px] text-gray-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Record Payment
        </h3>
        <p className="text-sm text-gray-500 mb-4">Invoice #{invoiceNumber} — {customerName}</p>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600 font-medium">Amount</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 bg-white text-gray-900 border-gray-300"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 font-medium">Payment Method</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="mt-1 bg-white text-gray-900 border-gray-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm text-gray-600 font-medium">Reference # (optional)</label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Check #, confirmation code, etc."
              className="mt-1 bg-white text-gray-900 border-gray-300"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 font-medium">Payment Date</label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="mt-1 bg-white text-gray-900 border-gray-300"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 font-medium">Memo (optional)</label>
            <Input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Internal notes"
              className="mt-1 bg-white text-gray-900 border-gray-300"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting} className="gap-2 bg-green-600 hover:bg-green-700">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
            Record Payment
          </Button>
        </div>
      </div>
    </div>
  );
}
