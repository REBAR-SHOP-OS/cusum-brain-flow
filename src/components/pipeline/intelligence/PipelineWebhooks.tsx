import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Webhook, Plus, Trash2, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const EVENT_OPTIONS = [
  { value: "stage_change", label: "Stage Change" },
  { value: "sla_breach", label: "SLA Breach" },
  { value: "lead_created", label: "Lead Created" },
  { value: "lead_won", label: "Lead Won" },
  { value: "lead_lost", label: "Lead Lost" },
  { value: "*", label: "All Events" },
];

export function PipelineWebhooks() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["stage_change"]);

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ["pipeline-webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("pipeline-webhooks", {
        method: "GET",
      });
      if (error) throw error;
      return data?.webhooks || [];
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("pipeline-webhooks", {
        body: { action: "register", url, events: selectedEvents, secret: secret || undefined, name: name || url },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Webhook registered");
      qc.invalidateQueries({ queryKey: ["pipeline-webhooks"] });
      setShowForm(false);
      setName("");
      setUrl("");
      setSecret("");
      setSelectedEvents(["stage_change"]);
    },
    onError: (e: any) => toast.error(e.message || "Failed to register webhook"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      const { error } = await supabase.functions.invoke("pipeline-webhooks", {
        body: { action: "delete", webhook_id: webhookId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Webhook deleted");
      qc.invalidateQueries({ queryKey: ["pipeline-webhooks"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      const { error } = await supabase.functions.invoke("pipeline-webhooks", {
        body: { action: "toggle", webhook_id: webhookId },
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-webhooks"] }),
  });

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Webhook className="w-4 h-4 text-primary" /> Pipeline Webhooks
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Outbound webhooks for pipeline events — integrate with Slack, Zapier, n8n, or any endpoint
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5 h-8 text-xs">
          <Plus className="w-3 h-3" /> Add Webhook
        </Button>
      </div>

      {/* Registration form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Slack webhook" className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">URL *</label>
                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://hooks.slack.com/..." className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Signing Secret (optional)</label>
              <Input value={secret} onChange={e => setSecret(e.target.value)} placeholder="Optional HMAC secret" className="h-8 text-xs" type="password" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Events</label>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_OPTIONS.map(ev => (
                  <Badge
                    key={ev.value}
                    variant={selectedEvents.includes(ev.value) ? "default" : "outline"}
                    className="cursor-pointer text-[10px] px-2 py-0.5"
                    onClick={() => toggleEvent(ev.value)}
                  >
                    {ev.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="h-7 text-xs">Cancel</Button>
              <Button size="sm" onClick={() => registerMutation.mutate()} disabled={!url || selectedEvents.length === 0 || registerMutation.isPending} className="h-7 text-xs gap-1">
                {registerMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Register
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhook list */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" /> Loading webhooks...
        </div>
      ) : webhooks.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-8 text-center">
            <Webhook className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No webhooks configured</p>
            <p className="text-[11px] text-muted-foreground mt-1">Add a webhook to receive pipeline event notifications</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {webhooks.map((wh: any) => (
            <Card key={wh.id} className="border-border">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={wh.enabled}
                    onCheckedChange={() => toggleMutation.mutate(wh.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{wh.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                      <ExternalLink className="w-2.5 h-2.5" /> {wh.url}
                    </p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(wh.events || []).map((ev: string) => (
                        <Badge key={ev} variant="secondary" className="text-[9px] px-1 py-0">{ev}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(wh.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
