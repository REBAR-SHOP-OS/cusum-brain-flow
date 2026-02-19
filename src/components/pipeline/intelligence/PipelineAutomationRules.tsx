import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Zap, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TRIGGER_EVENTS = [
  { value: "stage_change", label: "Stage Change" },
  { value: "sla_breach", label: "SLA Breach" },
  { value: "stale_lead", label: "Stale Lead" },
  { value: "value_change", label: "Value Change" },
  { value: "new_lead", label: "New Lead" },
];

const ACTION_TYPES = [
  { value: "auto_assign", label: "Auto-Assign" },
  { value: "auto_notify", label: "Auto-Notify" },
  { value: "auto_move_stage", label: "Auto-Move Stage" },
  { value: "auto_escalate", label: "Auto-Escalate" },
  { value: "auto_tag", label: "Auto-Tag" },
];

export function PipelineAutomationRules() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    trigger_event: "stage_change",
    action_type: "auto_notify",
    trigger_conditions: "{}",
    action_params: "{}",
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["pipeline-automation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_automation_rules" as any)
        .select("*")
        .order("priority", { ascending: true });
      if (error) { console.warn("pipeline_automation_rules:", error.message); return []; }
      return data || [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["user-profile-company"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("pipeline_automation_rules" as any)
        .update({ enabled } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-automation-rules"] });
      toast.success("Rule updated");
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("No company");
      let triggerCond = {};
      let actionParams = {};
      try { triggerCond = JSON.parse(newRule.trigger_conditions); } catch { /* empty */ }
      try { actionParams = JSON.parse(newRule.action_params); } catch { /* empty */ }

      const { error } = await supabase
        .from("pipeline_automation_rules" as any)
        .insert({
          company_id: profile.company_id,
          name: newRule.name,
          description: newRule.description || null,
          trigger_event: newRule.trigger_event,
          action_type: newRule.action_type,
          trigger_conditions: triggerCond,
          action_params: actionParams,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-automation-rules"] });
      setShowCreate(false);
      setNewRule({ name: "", description: "", trigger_event: "stage_change", action_type: "auto_notify", trigger_conditions: "{}", action_params: "{}" });
      toast.success("Automation rule created");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create rule"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pipeline_automation_rules" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-automation-rules"] });
      toast.success("Rule deleted");
    },
  });

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading automation rules...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {rules.length} rule{rules.length !== 1 ? "s" : ""} configured • {rules.filter((r: any) => r.enabled).length} active
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 h-7 text-xs">
              <Plus className="w-3 h-3" /> New Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Automation Rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={newRule.name} onChange={e => setNewRule(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Auto-escalate SLA breaches" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea value={newRule.description} onChange={e => setNewRule(p => ({ ...p, description: e.target.value }))} placeholder="What this rule does..." rows={2} className="text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Trigger Event</Label>
                  <Select value={newRule.trigger_event} onValueChange={v => setNewRule(p => ({ ...p, trigger_event: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRIGGER_EVENTS.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Action Type</Label>
                  <Select value={newRule.action_type} onValueChange={v => setNewRule(p => ({ ...p, action_type: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Trigger Conditions (JSON)</Label>
                <Textarea value={newRule.trigger_conditions} onChange={e => setNewRule(p => ({ ...p, trigger_conditions: e.target.value }))} rows={2} className="text-xs font-mono" placeholder='{"from_stage": "new", "to_stage": "qualified"}' />
              </div>
              <div>
                <Label className="text-xs">Action Parameters (JSON)</Label>
                <Textarea value={newRule.action_params} onChange={e => setNewRule(p => ({ ...p, action_params: e.target.value }))} rows={2} className="text-xs font-mono" placeholder='{"notify_roles": ["admin", "sales"]}' />
              </div>
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newRule.name || createMutation.isPending} className="w-full">
                Create Rule
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rules List */}
      <div className="space-y-2">
        {(rules as any[]).map((rule: any) => (
          <Card key={rule.id} className={cn("border-border", !rule.enabled && "opacity-50")}>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={enabled => toggleMutation.mutate({ id: rule.id, enabled })}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[13px] font-semibold">{rule.name}</span>
                  </div>
                  {rule.description && <p className="text-[11px] text-muted-foreground mb-1.5">{rule.description}</p>}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px]">
                      {TRIGGER_EVENTS.find(t => t.value === rule.trigger_event)?.label || rule.trigger_event}
                    </Badge>
                    <span className="text-muted-foreground text-[10px]">→</span>
                    <Badge variant="secondary" className="text-[9px]">
                      {ACTION_TYPES.find(a => a.value === rule.action_type)?.label || rule.action_type}
                    </Badge>
                    {rule.execution_count > 0 && (
                      <span className="text-[10px] text-muted-foreground">Executed {rule.execution_count}×</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(rule.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rules.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Settings2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No automation rules configured yet.</p>
          <p className="text-xs mt-1">Create your first rule to automate pipeline actions.</p>
        </div>
      )}
    </div>
  );
}
