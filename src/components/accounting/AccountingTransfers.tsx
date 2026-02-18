import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeftRight, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

export function AccountingTransfers({ data }: Props) {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split("T")[0]);
  const [lastTransfer, setLastTransfer] = useState<{ from: string; to: string; amount: number } | null>(null);

  const bankAccounts = data.accounts.filter(a => a.AccountType === "Bank");

  const handleCreate = async () => {
    if (!fromAccountId || !toAccountId || !amount || fromAccountId === toAccountId) return;
    setCreating(true);
    try {
      const { error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: {
          action: "create-transfer",
          fromAccountId,
          toAccountId,
          amount: parseFloat(amount),
          memo,
          txnDate,
        },
      });
      if (error) throw error;
      const fromName = bankAccounts.find(a => a.Id === fromAccountId)?.Name || "—";
      const toName = bankAccounts.find(a => a.Id === toAccountId)?.Name || "—";
      setLastTransfer({ from: fromName, to: toName, amount: parseFloat(amount) });
      toast({ title: "Transfer created", description: `$${parseFloat(amount).toFixed(2)} from ${fromName} → ${toName}` });
      setFromAccountId(""); setToAccountId(""); setAmount(""); setMemo("");
    } catch (e: any) {
      toast({ title: "Error creating transfer", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            Bank Transfer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>From Account</Label>
              <select value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select source...</option>
                {bankAccounts.map(a => <option key={a.Id} value={a.Id}>{a.Name}</option>)}
              </select>
            </div>
            <div>
              <Label>To Account</Label>
              <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select destination...</option>
                {bankAccounts.filter(a => a.Id !== fromAccountId).map(a => <option key={a.Id} value={a.Id}>{a.Name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Memo (optional)</Label>
            <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} placeholder="Transfer reason..." />
          </div>
          <Button onClick={handleCreate} disabled={creating || !fromAccountId || !toAccountId || !amount || fromAccountId === toAccountId} className="gap-2">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
            Create Transfer
          </Button>
        </CardContent>
      </Card>

      {lastTransfer && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
            <p className="text-sm">
              Last transfer: <span className="font-semibold">{fmt(lastTransfer.amount)}</span> from{" "}
              <span className="font-medium">{lastTransfer.from}</span> → <span className="font-medium">{lastTransfer.to}</span>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
