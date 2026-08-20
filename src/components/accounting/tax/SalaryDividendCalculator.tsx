import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { calculateScenarios, formatCurrency, type TaxScenario } from "@/lib/tax/taxCalculator";
import { cn } from "@/lib/utils";

export function SalaryDividendCalculator() {
  const [corpIncome, setCorpIncome] = useState(200000);
  const [otherIncome, setOtherIncome] = useState(0);
  const [wantRRSP, setWantRRSP] = useState(false);
  const [rrspAmount, setRrspAmount] = useState(0);

  const scenarios = calculateScenarios(corpIncome, otherIncome, wantRRSP, rrspAmount);
  const best = scenarios.reduce((a, b) => (a.totalTax < b.totalTax ? a : b));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">💰 Salary vs. Dividend Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Corporate Net Income</Label>
            <Input type="number" value={corpIncome} onChange={e => setCorpIncome(+e.target.value)} />
          </div>
          <div>
            <Label>Personal Other Income</Label>
            <Input type="number" value={otherIncome} onChange={e => setOtherIncome(+e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={wantRRSP} onCheckedChange={setWantRRSP} />
            <Label>Need RRSP Room?</Label>
          </div>
          {wantRRSP && (
            <div>
              <Label>RRSP Amount</Label>
              <Input type="number" value={rrspAmount} onChange={e => setRrspAmount(+e.target.value)} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarios.map((s) => (
            <ScenarioCard key={s.label} scenario={s} isBest={s.label === best.label} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ScenarioCard({ scenario: s, isBest }: { scenario: TaxScenario; isBest: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3",
      isBest ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border"
    )}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{s.label}</h3>
        {isBest && <Badge variant="default" className="text-[10px]">Best</Badge>}
      </div>
      <div className="space-y-1 text-sm">
        <Row label="Salary" value={formatCurrency(s.salary)} />
        <Row label="Dividend" value={formatCurrency(s.dividend)} />
        <Row label="Corp Tax" value={formatCurrency(s.corpTax)} />
        <Row label="Personal Tax" value={formatCurrency(s.personalTax)} />
        <Row label="CPP (Employee)" value={formatCurrency(s.cppEmployee)} />
        <Row label="CPP (Employer)" value={formatCurrency(s.cppEmployer)} />
        <div className="border-t pt-2 mt-2">
          <Row label="Total Tax" value={formatCurrency(s.totalTax)} bold />
          <Row label="After Tax" value={formatCurrency(s.afterTax)} bold className="text-primary" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className={cn("flex justify-between", bold && "font-semibold", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
