import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeadScoring, LEAD_FIELDS, OPERATORS } from "@/hooks/useLeadScoring";
import { Plus, RefreshCw, Trash2, Loader2, Zap, TrendingUp, Star } from "lucide-react";

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.min((score / max) * 100, 100) : 0;
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-bold w-8 text-right">{score}</span>
    </div>
  );
}

export function LeadScoringEngine() {
  const { rules, leads, isLoading, createRule, updateRule, deleteRule, recalculateAll } = useLeadScoring();
  const [tab, setTab] = useState("leaderboard");
  const [ruleDialog, setRuleDialog] = useState(false);
  const [form, setForm] = useState({ name: "", field_name: "stage", operator: "equals", field_value: "", score_points: 10 });

  const maxScore = Math.max(...leads.map(l => l.computed_score || 0), 1);
  const hotLeads = leads.filter(l => (l.computed_score || 0) >= maxScore * 0.7).length;
  const avgScore = leads.length > 0 ? Math.round(leads.reduce((sum, l) => sum + (l.computed_score || 0), 0) / leads.length) : 0;

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{rules.length}</p><p className="text-xs text-muted-foreground">Scoring Rules</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{leads.length}</p><p className="text-xs text-muted-foreground">Scored Leads</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{hotLeads}</p><p className="text-xs text-muted-foreground">Hot Leads (≥70%)</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{avgScore}</p><p className="text-xs text-muted-foreground">Avg Score</p></CardContent></Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={ruleDialog} onOpenChange={setRuleDialog}>
          <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> New Rule</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Scoring Rule</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Rule Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. High probability leads" /></div>
              <div><Label>Field</Label>
                <Select value={form.field_name} onValueChange={v => setForm(f => ({ ...f, field_name: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEAD_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Operator</Label>
                <Select value={form.operator} onValueChange={v => setForm(f => ({ ...f, operator: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {!["is_set", "is_not_set"].includes(form.operator) && (
                <div><Label>Value</Label><Input value={form.field_value} onChange={e => setForm(f => ({ ...f, field_value: e.target.value }))} placeholder="Match value" /></div>
              )}
              <div><Label>Points</Label><Input type="number" value={form.score_points} onChange={e => setForm(f => ({ ...f, score_points: parseInt(e.target.value) || 0 }))} /></div>
              <Button className="w-full" disabled={!form.name || createRule.isPending} onClick={() => {
                const payload = { ...form, field_value: ["is_set", "is_not_set"].includes(form.operator) ? "_" : form.field_value };
                createRule.mutate(payload, { onSuccess: () => { setRuleDialog(false); setForm({ name: "", field_name: "stage", operator: "equals", field_value: "", score_points: 10 }); } });
              }}>Create Rule</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Button size="sm" variant="outline" className="gap-1" onClick={() => recalculateAll.mutate()} disabled={recalculateAll.isPending}>
          <RefreshCw className={`w-4 h-4 ${recalculateAll.isPending ? "animate-spin" : ""}`} /> Recalculate All
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="leaderboard" className="gap-1"><TrendingUp className="w-3.5 h-3.5" /> Lead Scores</TabsTrigger>
          <TabsTrigger value="rules" className="gap-1"><Zap className="w-3.5 h-3.5" /> Rules ({rules.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="mt-3">
          <div className="space-y-1.5">
            {leads.map((lead, i) => (
              <Card key={lead.id} className="hover:ring-1 hover:ring-primary/20 transition-all">
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-6 text-right">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.title || "Untitled Lead"}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{lead.stage}</span>
                      {lead.priority && (
                        <Badge variant="outline" className="text-[10px] h-4">{lead.priority}</Badge>
                      )}
                      {lead.expected_value && <span>${Number(lead.expected_value).toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="w-32"><ScoreBar score={lead.computed_score || 0} max={maxScore} /></div>
                </CardContent>
              </Card>
            ))}
            {leads.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No leads found. Sync leads to start scoring.</p>}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="mt-3">
          <div className="space-y-2">
            {rules.map(rule => (
              <Card key={rule.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch checked={rule.enabled} onCheckedChange={v => updateRule.mutate({ id: rule.id, enabled: v })} />
                    <div>
                      <p className="text-sm font-medium">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {LEAD_FIELDS.find(f => f.value === rule.field_name)?.label || rule.field_name}
                        {" "}
                        {OPERATORS.find(o => o.value === rule.operator)?.label || rule.operator}
                        {!["is_set", "is_not_set"].includes(rule.operator) && <> "{rule.field_value}"</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={rule.score_points > 0 ? "default" : "destructive"} className="text-xs">
                      {rule.score_points > 0 ? "+" : ""}{rule.score_points} pts
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteRule.mutate(rule.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {rules.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No scoring rules yet. Create rules to start scoring leads.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
