import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Landmark, Search, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

interface Deposit {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  DepositToAccountRef?: { value: string; name: string };
  PrivateNote?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingDeposits({ data }: Props) {
  const { toast } = useToast();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [depositAccountId, setDepositAccountId] = useState("");
  const [lineAccountId, setLineAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [memo, setMemo] = useState("");
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split("T")[0]);

  const bankAccounts = data.accounts.filter(a => a.AccountType === "Bank");

  const loadDeposits = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "list-deposits" },
      });
      if (error) throw error;
      setDeposits(result?.deposits || []);
    } catch (e: any) {
      toast({ title: "Error loading deposits", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDeposits(); }, []);

  const handleCreate = async () => {
    if (!depositAccountId || !lineAccountId || !amount) return;
    setCreating(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: {
          action: "create-deposit",
          depositToAccountId: depositAccountId,
          lineItems: [{ amount: parseFloat(amount), accountId: lineAccountId, description }],
          memo,
          txnDate,
        },
      });
      if (error) throw error;
      toast({ title: "Deposit created", description: `${fmt(parseFloat(amount))} deposited` });
      setShowCreate(false);
      setDepositAccountId(""); setLineAccountId(""); setAmount(""); setDescription(""); setMemo("");
      loadDeposits();
    } catch (e: any) {
      toast({ title: "Error creating deposit", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const sorted = [...deposits].sort((a, b) => new Date(b.TxnDate).getTime() - new Date(a.TxnDate).getTime());
  const filtered = sorted.filter(d =>
    (d.DepositToAccountRef?.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.PrivateNote || "").toLowerCase().includes(search.toLowerCase())
  );
  const total = deposits.reduce((s, d) => s + d.TotalAmt, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input placeholder="Search deposits..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-12 text-base" />
        </div>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Landmark className="w-6 h-6 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Total Deposited</p>
              <p className="text-xl font-bold text-blue-600">{fmt(total)}</p>
            </div>
          </CardContent>
        </Card>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Deposit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5" />
            Deposits ({filtered.length})
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              {loading ? "Loading..." : "No deposits found."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Deposit To</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.Id}>
                    <TableCell>{new Date(d.TxnDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{d.DepositToAccountRef?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">{d.PrivateNote || "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(d.TotalAmt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Deposit</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Deposit To Account</Label>
              <select value={depositAccountId} onChange={(e) => setDepositAccountId(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select bank account...</option>
                {bankAccounts.map(a => <option key={a.Id} value={a.Id}>{a.Name}</option>)}
              </select>
            </div>
            <div>
              <Label>Source Account (received from)</Label>
              <select value={lineAccountId} onChange={(e) => setLineAccountId(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select account...</option>
                {data.accounts.map(a => <option key={a.Id} value={a.Id}>{a.Name} ({a.AccountType})</option>)}
              </select>
            </div>
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deposit description" />
            </div>
            <div>
              <Label>Memo (optional)</Label>
              <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !depositAccountId || !lineAccountId || !amount}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create Deposit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
