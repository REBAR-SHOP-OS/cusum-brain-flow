import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/tax/taxCalculator";
import { CheckCircle2, AlertTriangle } from "lucide-react";

const ITC_CATEGORIES = [
  { key: "capital", label: "Capital Purchases", description: "Equipment, vehicles, machinery" },
  { key: "operating", label: "Operating Expenses", description: "Rent, utilities, supplies" },
  { key: "professional", label: "Professional Services", description: "Accounting, legal, consulting" },
  { key: "technology", label: "Technology & Software", description: "SaaS, hosting, hardware" },
  { key: "travel", label: "Travel & Meals", description: "Business travel (50% meals)" },
  { key: "marketing", label: "Marketing & Advertising", description: "Ads, printing, promotions" },
  { key: "vehicle", label: "Vehicle Expenses", description: "Fuel, repairs, insurance (business %)" },
  { key: "other", label: "Other Eligible", description: "Bank fees, shipping, misc." },
];

export function GSTHSTReview() {
  const [categories, setCategories] = useState(
    ITC_CATEGORIES.map(c => ({ ...c, eligible: 0, claimed: 0 }))
  );

  const totalEligible = categories.reduce((s, c) => s + c.eligible, 0);
  const totalClaimed = categories.reduce((s, c) => s + c.claimed, 0);
  const gap = totalEligible - totalClaimed;
  const pct = totalEligible > 0 ? (totalClaimed / totalEligible) * 100 : 0;

  const update = (idx: number, field: "eligible" | "claimed", val: number) => {
    setCategories(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">🧾 GST/HST ITC Review</CardTitle>
        {gap > 0 ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="w-3 h-3" /> {formatCurrency(gap)} unclaimed
          </Badge>
        ) : totalEligible > 0 ? (
          <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> All claimed
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Claimed: {formatCurrency(totalClaimed)}</span>
            <span>Eligible: {formatCurrency(totalEligible)}</span>
          </div>
          <Progress value={pct} className="h-3" />
        </div>

        <div className="space-y-2">
          {categories.map((cat, idx) => (
            <div key={cat.key} className="p-3 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-medium">{cat.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{cat.description}</span>
                </div>
                {cat.eligible > 0 && cat.claimed < cat.eligible && (
                  <Badge variant="outline" className="text-[10px] text-amber-600">Gap: {formatCurrency(cat.eligible - cat.claimed)}</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Eligible ITCs</Label>
                  <Input type="number" className="h-8 text-sm" value={cat.eligible} onChange={e => update(idx, "eligible", +e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Claimed ITCs</Label>
                  <Input type="number" className="h-8 text-sm" value={cat.claimed} onChange={e => update(idx, "claimed", +e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
          <p>💡 <strong>Quick Method:</strong> If revenue is under ~$400K with high margins, consider the Quick Method — it can save thousands annually.</p>
          <p>💡 <strong>Mixed-use:</strong> Review personal-use portions of vehicle, phone, and home office to ensure correct ITC allocation.</p>
        </div>
      </CardContent>
    </Card>
  );
}
