import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const REPORT_TYPES = [
  { value: "pl", label: "Profit & Loss" },
  { value: "ar_aging", label: "AR Aging" },
  { value: "cash_flow", label: "Cash Flow" },
  { value: "balance_sheet", label: "Balance Sheet" },
  { value: "trial_balance", label: "Trial Balance" },
];

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function AccountingScheduledReports() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", report_type: "pl", frequency: "weekly", recipients: "" });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["scheduled-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_reports" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const createReport = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("company_id").limit(1).single();
      if (!profile?.company_id) throw new Error("No company");

      const nextRun = new Date();
      if (form.frequency === "daily") nextRun.setDate(nextRun.getDate() + 1);
      else if (form.frequency === "weekly") nextRun.setDate(nextRun.getDate() + 7);
      else nextRun.setMonth(nextRun.getMonth() + 1);

      const { error } = await supabase.from("scheduled_reports" as any).insert({
        company_id: profile.company_id,
        name: form.name || `${REPORT_TYPES.find(r => r.value === form.report_type)?.label} Report`,
        report_type: form.report_type,
        frequency: form.frequency,
        recipients: form.recipients.split(",").map(e => e.trim()).filter(Boolean),
        next_run_at: nextRun.toISOString(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast.success("Scheduled report created");
      setOpen(false);
      setForm({ name: "", report_type: "pl", frequency: "weekly", recipients: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("scheduled_reports" as any)
        .update({ enabled } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] }),
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scheduled_reports" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast.success("Report deleted");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Scheduled Reports</h2>
          <p className="text-sm text-muted-foreground">Auto-generate and email reports on a schedule.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> New Schedule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule a Report</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Report Name</Label>
                <Input placeholder="e.g. Weekly P&L" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Report Type</Label>
                <Select value={form.report_type} onValueChange={v => setForm(f => ({ ...f, report_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recipients (comma-separated emails)</Label>
                <Input placeholder="vicky@rebar.shop, neel@rebar.shop" value={form.recipients} onChange={e => setForm(f => ({ ...f, recipients: e.target.value }))} />
              </div>
              <Button onClick={() => createReport.mutate()} disabled={createReport.isPending} className="w-full">
                {createReport.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Schedule
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : reports.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No scheduled reports yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {reports.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{r.name}</p>
                    <Badge variant="outline" className="text-xs">{REPORT_TYPES.find(t => t.value === r.report_type)?.label}</Badge>
                    <Badge variant="secondary" className="text-xs capitalize">{r.frequency}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Next: {r.next_run_at ? new Date(r.next_run_at).toLocaleDateString() : "—"}
                    {r.recipients?.length > 0 && ` · To: ${r.recipients.join(", ")}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Switch checked={r.enabled} onCheckedChange={enabled => toggleEnabled.mutate({ id: r.id, enabled })} />
                  <Button variant="ghost" size="icon" onClick={() => deleteReport.mutate(r.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
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
