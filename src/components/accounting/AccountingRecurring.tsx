import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Repeat, Play, Pause, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

interface RecurringTxn {
  Id: string;
  RecurTemplate?: { TxnType?: string; RecurType?: string; Active?: boolean };
  TxnType?: string;
  RecurType?: string;
  Active?: boolean;
  NextDate?: string;
  EndDate?: string;
  Interval?: number;
  Line?: any[];
  TotalAmt?: number;
  CustomerRef?: { name?: string };
  VendorRef?: { name?: string };
}

export function AccountingRecurring({ data }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<RecurringTxn[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "query", query: "SELECT * FROM RecurringTransaction MAXRESULTS 200" },
      });
      if (error) throw error;
      setItems(res?.QueryResponse?.RecurringTransaction || []);
    } catch (e: any) {
      toast({ title: "Failed to load recurring transactions", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const filtered = items.filter(i => {
    const name = i.CustomerRef?.name || i.VendorRef?.name || "";
    const type = i.TxnType || i.RecurTemplate?.TxnType || "";
    return name.toLowerCase().includes(search.toLowerCase()) || type.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2"><Repeat className="w-5 h-5" /> Recurring Transactions</h2>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recurring..." className="pl-9" />
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No recurring transactions found.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(item => {
            const type = item.TxnType || item.RecurTemplate?.TxnType || "Unknown";
            const active = item.Active ?? item.RecurTemplate?.Active ?? false;
            const name = item.CustomerRef?.name || item.VendorRef?.name || "—";
            return (
              <Card key={item.Id}>
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {active ? <Play className="w-4 h-4 text-emerald-500" /> : <Pause className="w-4 h-4 text-muted-foreground" />}
                    <div>
                      <p className="font-medium text-sm">{name}</p>
                      <p className="text-xs text-muted-foreground">{type} · Next: {item.NextDate || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{item.TotalAmt ? fmt(item.TotalAmt) : "—"}</span>
                    <Badge variant={active ? "default" : "secondary"}>{active ? "Active" : "Paused"}</Badge>
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
