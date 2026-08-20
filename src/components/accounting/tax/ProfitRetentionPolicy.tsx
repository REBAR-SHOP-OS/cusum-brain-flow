import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTaxPlanning } from "@/hooks/useTaxPlanning";
import { formatCurrency } from "@/lib/tax/taxCalculator";

export function ProfitRetentionPolicy() {
  const { profile, upsert } = useTaxPlanning();
  const target = Number(profile?.target_retained_earnings || 0);
  const maxPct = Number(profile?.max_withdrawal_pct || 100);

  const [retainedEarnings, setRetainedEarnings] = useState(0);
  const [upcomingObligations, setUpcomingObligations] = useState(0);

  const available = Math.max(0, retainedEarnings - target - upcomingObligations);
  const maxWithdrawal = available * (maxPct / 100);
  const retentionPct = retainedEarnings > 0 ? Math.min(100, (target / retainedEarnings) * 100) : 0;

  const [editing, setEditing] = useState(false);
  const [editTarget, setEditTarget] = useState(target);
  const [editMaxPct, setEditMaxPct] = useState(maxPct);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">🏦 Profit Retention Policy</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => { setEditing(!editing); setEditTarget(target); setEditMaxPct(maxPct); }}>
          {editing ? "Cancel" : "Configure"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Min Retained Earnings Target</Label>
              <Input type="number" value={editTarget} onChange={e => setEditTarget(+e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Max Withdrawal %</Label>
              <Input type="number" value={editMaxPct} onChange={e => setEditMaxPct(+e.target.value)} />
            </div>
            <Button size="sm" className="col-span-2" onClick={() => {
              upsert.mutate({ target_retained_earnings: editTarget, max_withdrawal_pct: editMaxPct });
              setEditing(false);
            }}>Save Policy</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Current Retained Earnings</Label>
                <Input type="number" value={retainedEarnings} onChange={e => setRetainedEarnings(+e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Upcoming Obligations</Label>
                <Input type="number" value={upcomingObligations} onChange={e => setUpcomingObligations(+e.target.value)} />
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex justify-between text-sm">
                <span>Retention Target</span>
                <span className="font-medium">{formatCurrency(target)}</span>
              </div>
              <Progress value={retentionPct} className="h-2" />
              <div className="flex justify-between text-sm">
                <span>Max Withdrawal ({maxPct}%)</span>
                <span className="font-semibold text-primary">{formatCurrency(maxWithdrawal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 You can safely withdraw up to {formatCurrency(maxWithdrawal)} while maintaining your retention target and covering obligations.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
