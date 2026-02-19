import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Table2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PIPELINE_STAGES } from "@/pages/Pipeline";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

interface Props {
  leads: Lead[];
  outcomes: any[];
}

type ReportType = "pipeline_summary" | "stage_breakdown" | "win_loss" | "stale_leads" | "sla_breaches";

const REPORT_TYPES: { value: ReportType; label: string; icon: React.ElementType }[] = [
  { value: "pipeline_summary", label: "Pipeline Summary", icon: Table2 },
  { value: "stage_breakdown", label: "Stage Breakdown", icon: Table2 },
  { value: "win_loss", label: "Win/Loss Analysis", icon: Table2 },
  { value: "stale_leads", label: "Stale Leads", icon: Table2 },
  { value: "sla_breaches", label: "SLA Breaches", icon: Table2 },
];

function downloadCSV(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) { toast.error("No data to export"); return; }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(row => headers.map(h => {
      const val = row[h];
      const str = val == null ? "" : String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${rows.length} rows`);
}

export function PipelineReporting({ leads, outcomes }: Props) {
  const [reportType, setReportType] = useState<ReportType>("pipeline_summary");

  const TERMINAL = new Set(["won", "lost", "loss", "merged", "archived_orphan"]);

  const generateReport = useCallback(() => {
    switch (reportType) {
      case "pipeline_summary": {
        const rows = leads.map(l => ({
          Title: l.title,
          Stage: PIPELINE_STAGES.find(s => s.id === l.stage)?.label || l.stage,
          "Expected Value": l.expected_value || 0,
          Probability: l.probability ?? "",
          "Win Score": l.win_prob_score ?? "",
          "Priority Score": l.priority_score ?? "",
          "SLA Breached": l.sla_breached ? "Yes" : "No",
          Created: format(new Date(l.created_at), "yyyy-MM-dd"),
          Updated: format(new Date(l.updated_at), "yyyy-MM-dd"),
        }));
        downloadCSV(rows, "pipeline_summary");
        break;
      }
      case "stage_breakdown": {
        const stageMap: Record<string, { count: number; value: number }> = {};
        leads.forEach(l => {
          if (!stageMap[l.stage]) stageMap[l.stage] = { count: 0, value: 0 };
          stageMap[l.stage].count++;
          stageMap[l.stage].value += (l.expected_value as number) || 0;
        });
        const rows = Object.entries(stageMap).map(([stage, data]) => ({
          Stage: PIPELINE_STAGES.find(s => s.id === stage)?.label || stage,
          "Lead Count": data.count,
          "Total Value": Math.round(data.value),
          "Avg Value": data.count > 0 ? Math.round(data.value / data.count) : 0,
        }));
        downloadCSV(rows, "stage_breakdown");
        break;
      }
      case "win_loss": {
        const wonLeads = leads.filter(l => l.stage === "won");
        const lostLeads = leads.filter(l => l.stage === "lost" || l.stage === "loss");
        const rows = [...wonLeads, ...lostLeads].map(l => ({
          Title: l.title,
          Outcome: l.stage === "won" ? "Won" : "Lost",
          "Expected Value": l.expected_value || 0,
          "Win Score": l.win_prob_score ?? "",
          Created: format(new Date(l.created_at), "yyyy-MM-dd"),
          Closed: format(new Date(l.updated_at), "yyyy-MM-dd"),
          "Days to Close": Math.max(1, Math.round((new Date(l.updated_at).getTime() - new Date(l.created_at).getTime()) / 86400000)),
        }));
        downloadCSV(rows, "win_loss_analysis");
        break;
      }
      case "stale_leads": {
        const now = new Date();
        const stale = leads.filter(l => {
          if (TERMINAL.has(l.stage)) return false;
          return (now.getTime() - new Date(l.updated_at).getTime()) / 86400000 >= 14;
        });
        const rows = stale.map(l => ({
          Title: l.title,
          Stage: PIPELINE_STAGES.find(s => s.id === l.stage)?.label || l.stage,
          "Expected Value": l.expected_value || 0,
          "Days Since Update": Math.round((now.getTime() - new Date(l.updated_at).getTime()) / 86400000),
          "Last Updated": format(new Date(l.updated_at), "yyyy-MM-dd"),
        }));
        downloadCSV(rows, "stale_leads");
        break;
      }
      case "sla_breaches": {
        const breached = leads.filter(l => l.sla_breached === true);
        const rows = breached.map(l => ({
          Title: l.title,
          Stage: PIPELINE_STAGES.find(s => s.id === l.stage)?.label || l.stage,
          "Expected Value": l.expected_value || 0,
          "SLA Deadline": l.sla_deadline ? format(new Date(l.sla_deadline), "yyyy-MM-dd HH:mm") : "",
          "Escalated To": l.escalated_to || "",
          "Last Updated": format(new Date(l.updated_at), "yyyy-MM-dd"),
        }));
        downloadCSV(rows, "sla_breaches");
        break;
      }
    }
  }, [reportType, leads]);

  // Quick stats for the selected report type
  const quickStats = useMemo(() => {
    switch (reportType) {
      case "pipeline_summary":
        return `${leads.length} leads • $${leads.reduce((s, l) => s + ((l.expected_value as number) || 0), 0).toLocaleString()} total value`;
      case "stage_breakdown": {
        const stages = new Set(leads.map(l => l.stage));
        return `${stages.size} stages with leads`;
      }
      case "win_loss": {
        const won = leads.filter(l => l.stage === "won").length;
        const lost = leads.filter(l => l.stage === "lost" || l.stage === "loss").length;
        return `${won} won • ${lost} lost • ${won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0}% win rate`;
      }
      case "stale_leads": {
        const stale = leads.filter(l => !TERMINAL.has(l.stage) && (Date.now() - new Date(l.updated_at).getTime()) / 86400000 >= 14);
        return `${stale.length} stale leads (14+ days)`;
      }
      case "sla_breaches": {
        const breached = leads.filter(l => l.sla_breached === true);
        return `${breached.length} breached leads`;
      }
      default:
        return "";
    }
  }, [reportType, leads]);

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-primary" /> Export Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Report Type</label>
              <Select value={reportType} onValueChange={v => setReportType(v as ReportType)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map(r => (
                    <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={generateReport} className="gap-1.5 h-8 text-xs">
              <Download className="w-3 h-3" /> Export CSV
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">{quickStats}</p>
        </CardContent>
      </Card>

      {/* Report Previews */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORT_TYPES.map(r => {
          const isSelected = r.value === reportType;
          return (
            <Card
              key={r.value}
              className={cn("border-border cursor-pointer transition-colors hover:bg-muted/30", isSelected && "ring-1 ring-primary")}
              onClick={() => setReportType(r.value)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <r.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">{r.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {r.value === "pipeline_summary" && "Full pipeline data with scores and SLA status"}
                  {r.value === "stage_breakdown" && "Lead counts and values per pipeline stage"}
                  {r.value === "win_loss" && "Won vs lost analysis with cycle time"}
                  {r.value === "stale_leads" && "Active leads with no updates in 14+ days"}
                  {r.value === "sla_breaches" && "All leads that have breached their SLA deadline"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
