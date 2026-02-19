import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calendar, Mail } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface ScheduledReport {
  id: string;
  name: string;
  report_type: string;
  frequency: string;
  recipients: string[];
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string;
  created_at: string;
}

const REPORT_TYPES = [
  { value: "pipeline_summary", label: "Pipeline Summary" },
  { value: "win_loss", label: "Win/Loss Report" },
  { value: "sla_report", label: "SLA Report" },
  { value: "rep_performance", label: "Rep Performance" },
  { value: "forecast", label: "Forecast Report" },
];

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

export function ScheduledReportsManager() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("pipeline_summary");
  const [newFreq, setNewFreq] = useState("weekly");
  const [newRecipients, setNewRecipients] = useState("");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["scheduled-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ScheduledReport[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !companyId) throw new Error("Not authenticated");
      const nextRun = new Date();
      nextRun.setDate(nextRun.getDate() + (newFreq === "daily" ? 1 : newFreq === "weekly" ? 7 : newFreq === "biweekly" ? 14 : 30));
      const { error } = await supabase.from("scheduled_reports").insert({
        company_id: companyId,
        created_by: user.id,
        name: newName,
        report_type: newType,
        frequency: newFreq,
        recipients: newRecipients.split(",").map(e => e.trim()).filter(Boolean),
        next_run_at: nextRun.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast.success("Report scheduled");
      setIsCreateOpen(false);
      setNewName("");
      setNewRecipients("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("scheduled_reports").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scheduled_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast.success("Report deleted");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Scheduled Reports</h3>
        <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> Schedule Report
        </Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No scheduled reports yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{report.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px]">
                      {REPORT_TYPES.find(t => t.value === report.report_type)?.label}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {FREQUENCIES.find(f => f.value === report.frequency)?.label}
                    </Badge>
                    {report.recipients.length > 0 && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Mail className="w-2.5 h-2.5" /> {report.recipients.length} recipient(s)
                      </span>
                    )}
                  </div>
                </div>
                <Switch
                  checked={report.enabled}
                  onCheckedChange={(enabled) => toggleMutation.mutate({ id: report.id, enabled })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => deleteMutation.mutate(report.id)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule a Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Report Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Weekly Pipeline Summary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Report Type</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Frequency</Label>
                <Select value={newFreq} onValueChange={setNewFreq}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Recipients (comma-separated emails)</Label>
              <Input value={newRecipients} onChange={(e) => setNewRecipients(e.target.value)} placeholder="team@company.com, manager@company.com" />
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={!newName || createMutation.isPending} className="w-full">
              {createMutation.isPending ? "Creating..." : "Create Schedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
