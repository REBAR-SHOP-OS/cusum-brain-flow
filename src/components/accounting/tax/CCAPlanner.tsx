import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCCASchedule } from "@/hooks/useCCASchedule";
import { CCA_CLASSES } from "@/lib/tax/canadianTaxRates";
import { formatCurrency } from "@/lib/tax/taxCalculator";
import { Plus, Trash2, Loader2 } from "lucide-react";

export function CCAPlanner() {
  const { items, isLoading, upsertItem, deleteItem } = useCCASchedule();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ asset_description: "", cca_class: 10, ucc_opening: 0, additions: 0, dispositions: 0, cca_rate: 30, cca_claimed: 0, ucc_closing: 0, use_this_year: true });

  const totalCCA = items.filter(i => i.use_this_year).reduce((s, i) => s + Number(i.cca_claimed), 0);

  if (isLoading) return <Loader2 className="w-6 h-6 animate-spin mx-auto" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">📉 CCA Depreciation Planner</CardTitle>
        <span className="text-sm font-medium text-primary">Total CCA: {formatCurrency(totalCCA)}</span>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground text-center py-4">No CCA items yet. Add your capital assets to plan depreciation strategically.</p>
        )}

        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
            <Switch checked={item.use_this_year} onCheckedChange={(v) => upsertItem.mutate({ id: item.id, use_this_year: v })} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.asset_description}</p>
              <p className="text-xs text-muted-foreground">Class {item.cca_class} @ {item.cca_rate}% — UCC: {formatCurrency(Number(item.ucc_opening))}</p>
            </div>
            <span className="text-sm font-semibold">{formatCurrency(Number(item.cca_claimed))}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteItem.mutate(item.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}

        {adding ? (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <Input placeholder="Asset description" value={form.asset_description} onChange={e => setForm({ ...form, asset_description: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <select className="border rounded px-2 py-1.5 text-sm bg-background" value={form.cca_class} onChange={e => {
                const cls = CCA_CLASSES.find(c => c.classNum === +e.target.value);
                setForm({ ...form, cca_class: +e.target.value, cca_rate: cls?.rate || 30 });
              }}>
                {CCA_CLASSES.map(c => <option key={c.classNum} value={c.classNum}>Class {c.classNum} ({c.rate}%)</option>)}
              </select>
              <Input type="number" placeholder="UCC Opening" value={form.ucc_opening} onChange={e => setForm({ ...form, ucc_opening: +e.target.value })} />
              <Input type="number" placeholder="CCA Claimed" value={form.cca_claimed} onChange={e => setForm({ ...form, cca_claimed: +e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => {
                if (form.asset_description) { upsertItem.mutate(form); setAdding(false); setForm({ asset_description: "", cca_class: 10, ucc_opening: 0, additions: 0, dispositions: 0, cca_rate: 30, cca_claimed: 0, ucc_closing: 0, use_this_year: true }); }
              }}>Add Asset</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Capital Asset
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
