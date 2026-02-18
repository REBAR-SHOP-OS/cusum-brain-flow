import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTaxPlanning } from "@/hooks/useTaxPlanning";
import { formatCurrency } from "@/lib/tax/taxCalculator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function HSATracker() {
  const { profile, upsert } = useTaxPlanning();
  const limit = Number(profile?.hsa_annual_limit || 0);
  const claimed = Number(profile?.hsa_claimed_ytd || 0);
  const pct = limit > 0 ? Math.min(100, (claimed / limit) * 100) : 0;

  const [editing, setEditing] = useState(false);
  const [editLimit, setEditLimit] = useState(limit);
  const [editClaimed, setEditClaimed] = useState(claimed);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">🏥 Health Spending Account</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => { setEditing(!editing); setEditLimit(limit); setEditClaimed(claimed); }}>
          {editing ? "Cancel" : "Edit"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Annual Limit</Label>
              <Input type="number" value={editLimit} onChange={e => setEditLimit(+e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Claimed YTD</Label>
              <Input type="number" value={editClaimed} onChange={e => setEditClaimed(+e.target.value)} />
            </div>
            <Button size="sm" className="col-span-2" onClick={() => {
              upsert.mutate({ hsa_annual_limit: editLimit, hsa_claimed_ytd: editClaimed });
              setEditing(false);
            }}>Save</Button>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-sm">
              <span>Claimed: {formatCurrency(claimed)}</span>
              <span>Limit: {formatCurrency(limit)}</span>
            </div>
            <Progress value={pct} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {limit > 0
                ? `${formatCurrency(limit - claimed)} remaining — covers dental, vision, prescriptions, therapy`
                : "Set your HSA annual limit to start tracking. This converts personal after-tax spending → corporate pre-tax spending."}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
