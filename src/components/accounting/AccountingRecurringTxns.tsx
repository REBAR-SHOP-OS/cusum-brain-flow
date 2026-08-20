import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Calendar, RepeatIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const TXN_TYPES = [
  { value: "Invoice", label: "Invoice" },
  { value: "Bill", label: "Bill" },
  { value: "SalesReceipt", label: "Sales Receipt" },
];

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export function AccountingRecurringTxns() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    transaction_type: "Invoice",
    frequency: "monthly",
    memo: "",
    amount: "",
  });

  const { data: recurring = [], isLoading } = useQuery({
    queryKey: ["recurring-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_transactions" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const createRecurring = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("company_id, user_id").limit(1).single();
      if (!profile?.company_id) throw new Error("No company");

      const nextRun = new Date();
      const freq = form.frequency;
      if (freq === "weekly") nextRun.setDate(nextRun.getDate() + 7);
      else if (freq === "biweekly") nextRun.setDate(nextRun.getDate() + 14);
      else if (freq === "monthly") nextRun.setMonth(nextRun.getMonth() + 1);
      else if (freq === "quarterly") nextRun.setMonth(nextRun.getMonth() + 3);
      else if (freq === "yearly") nextRun.setFullYear(nextRun.getFullYear() + 1);

      const { error } = await supabase.from("recurring_transactions" as any).insert({
        company_id: profile.company_id,
        name: form.name || `Recurring ${form.transaction_type}`,
        transaction_type: form.transaction_type,
        frequency: form.frequency,
        next_run_at: nextRun.toISOString(),
        template_data: {
          memo: form.memo,
          amount: parseFloat(form.amount) || 0,
        },
        created_by: profile.user_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
      toast.success("Recurring transaction created");
      setOpen(false);
      setForm({ name: "", transaction_type: "Invoice", frequency: "monthly", memo: "", amount: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("recurring_transactions" as any)
        .update({ enabled } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] }),
  });

  const deleteRecurring = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_transactions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
      toast.success("Recurring transaction deleted");
    },
  });

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Recurring Transactions</h2>
          <p className="text-sm text-muted-foreground">Auto-create invoices, bills, and receipts on a schedule.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> New Recurring</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Recurring Transaction</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input placeholder="e.g. Monthly Office Rent" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Transaction Type</Label>
                <Select value={form.transaction_type} onValueChange={v => setForm(f => ({ ...f, transaction_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TXN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>Memo</Label>
                <Input placeholder="Optional memo" value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
              </div>
              <Button onClick={() => createRecurring.mutate()} disabled={createRecurring.isPending} className="w-full">
                {createRecurring.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : recurring.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No recurring transactions yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {recurring.map((r: any) => {
            const tpl = r.template_data || {};
            return (
              <Card key={r.id}>
                <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <RepeatIcon className="w-4 h-4 text-primary shrink-0" />
                      <p className="font-medium text-sm">{r.name}</p>
                      <Badge variant="outline" className="text-xs">{r.transaction_type}</Badge>
                      <Badge variant="secondary" className="text-xs capitalize">{r.frequency}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      Next: {r.next_run_at ? new Date(r.next_run_at).toLocaleDateString() : "—"}
                      {tpl.amount ? ` · ${fmt(tpl.amount)}` : ""}
                      {r.last_run_at ? ` · Last: ${new Date(r.last_run_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Switch checked={r.enabled} onCheckedChange={enabled => toggleEnabled.mutate({ id: r.id, enabled })} />
                    <Button variant="ghost" size="icon" onClick={() => deleteRecurring.mutate(r.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
