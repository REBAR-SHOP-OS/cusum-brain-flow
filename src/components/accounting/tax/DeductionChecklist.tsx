import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useTaxDeductions } from "@/hooks/useTaxDeductions";
import { DEDUCTION_CATEGORIES } from "@/lib/tax/canadianTaxRates";
import { formatCurrency } from "@/lib/tax/taxCalculator";
import { Plus, Loader2 } from "lucide-react";

export function DeductionChecklist() {
  const { deductions, isLoading, upsertDeduction } = useTaxDeductions();
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("other");
  const [newDesc, setNewDesc] = useState("");
  const [newEst, setNewEst] = useState(0);

  const totalEstimated = deductions.reduce((s, d) => s + Number(d.estimated_amount), 0);
  const totalClaimed = deductions.reduce((s, d) => s + Number(d.claimed_amount), 0);

  if (isLoading) return <Loader2 className="w-6 h-6 animate-spin mx-auto" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">📋 Expense Maximization</CardTitle>
        <div className="text-sm text-muted-foreground">
          {formatCurrency(totalClaimed)} / {formatCurrency(totalEstimated)} claimed
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {DEDUCTION_CATEGORIES.map(cat => {
          const items = deductions.filter(d => d.category === cat.key);
          return (
            <div key={cat.key} className="p-3 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{cat.label}</span>
                <span className="text-xs text-muted-foreground">{cat.description}</span>
              </div>
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-2 ml-4 mt-1">
                  <Checkbox
                    checked={item.is_claimed}
                    onCheckedChange={(v) => upsertDeduction.mutate({ ...item, is_claimed: !!v, estimated_amount: Number(item.estimated_amount), claimed_amount: Number(item.claimed_amount) })}
                  />
                  <span className="text-sm flex-1">{item.description}</span>
                  <span className="text-xs text-muted-foreground">{formatCurrency(Number(item.estimated_amount))}</span>
                </div>
              ))}
              {items.length === 0 && <p className="text-xs text-muted-foreground ml-4 italic">No items yet</p>}
            </div>
          );
        })}

        {adding ? (
          <div className="flex gap-2 items-end p-3 bg-muted/50 rounded-lg">
            <select className="border rounded px-2 py-1.5 text-sm bg-background" value={newCat} onChange={e => setNewCat(e.target.value)}>
              {DEDUCTION_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <Input placeholder="Description" className="flex-1" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            <Input type="number" placeholder="Est." className="w-24" value={newEst} onChange={e => setNewEst(+e.target.value)} />
            <Button size="sm" onClick={() => {
              if (newDesc) {
                upsertDeduction.mutate({ category: newCat, description: newDesc, estimated_amount: newEst, claimed_amount: 0, is_claimed: false });
                setNewDesc(""); setNewEst(0); setAdding(false);
              }
            }}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Deduction
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
