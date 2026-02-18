import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Receipt, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

interface QBPurchase {
  Id: string;
  TxnDate?: string;
  TotalAmt?: number;
  PaymentType?: string;
  AccountRef?: { name?: string };
  EntityRef?: { name?: string };
  Line?: any[];
  DocNumber?: string;
  PrivateNote?: string;
}

export function AccountingExpenses({ data }: Props) {
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<QBPurchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "query", query: "SELECT * FROM Purchase ORDERBY TxnDate DESC MAXRESULTS 200" },
      });
      if (error) throw error;
      setPurchases(res?.QueryResponse?.Purchase || []);
    } catch (e: any) {
      toast({ title: "Failed to load expenses", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const filtered = purchases.filter(p => {
    const q = search.toLowerCase();
    return (p.EntityRef?.name || "").toLowerCase().includes(q) ||
      (p.AccountRef?.name || "").toLowerCase().includes(q) ||
      (p.DocNumber || "").toLowerCase().includes(q) ||
      (p.PrivateNote || "").toLowerCase().includes(q);
  });

  const totalAmt = filtered.reduce((s, p) => s + (p.TotalAmt || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2"><Receipt className="w-5 h-5" /> Expenses / Purchases</h2>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..." className="pl-9" />
        </div>
        <Badge variant="secondary" className="text-sm py-1 px-3">Total: {fmt(totalAmt)}</Badge>
      </div>

      {loading && purchases.length === 0 ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No expenses found.</CardContent></Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Payee</th>
                <th className="py-2 pr-4">Account</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Ref #</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.Id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 pr-4">{p.TxnDate || "—"}</td>
                  <td className="py-2 pr-4 font-medium">{p.EntityRef?.name || "—"}</td>
                  <td className="py-2 pr-4">{p.AccountRef?.name || "—"}</td>
                  <td className="py-2 pr-4"><Badge variant="outline" className="text-xs">{p.PaymentType || "—"}</Badge></td>
                  <td className="py-2 pr-4 text-muted-foreground">{p.DocNumber || "—"}</td>
                  <td className="py-2 text-right font-semibold">{fmt(p.TotalAmt || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
