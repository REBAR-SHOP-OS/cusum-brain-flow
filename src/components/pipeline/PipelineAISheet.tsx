import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp, AlertTriangle, Clock, BarChart3, Send,
  Users, Target, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import type { Tables } from "@/integrations/supabase/types";
import { differenceInDays } from "date-fns";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface PipelineAISheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: LeadWithCustomer[];
}

const QUICK_ACTIONS = [
  { id: "pipeline_audit", label: "Pipeline Audit", icon: Target, desc: "Full accountability check" },
  { id: "stale_report", label: "Stale Leads", icon: Clock, desc: "Leads needing attention" },
  { id: "followup_gaps", label: "Follow-up Gaps", icon: AlertTriangle, desc: "Missing follow-ups" },
  { id: "revenue_forecast", label: "Revenue Forecast", icon: BarChart3, desc: "Weighted pipeline value" },
  { id: "salesperson_report", label: "Team Performance", icon: Users, desc: "Salesperson rankings" },
];

function buildPipelineStats(leads: LeadWithCustomer[]) {
  const byStage: Record<string, number> = {};
  const bySalesperson: Record<string, { total: number; stale: number; value: number }> = {};
  let staleCount = 0;
  let totalValue = 0;
  let weightedValue = 0;

  leads.forEach((lead) => {
    byStage[lead.stage] = (byStage[lead.stage] || 0) + 1;
    const meta = lead.metadata as Record<string, unknown> | null;
    const sp = (meta?.odoo_salesperson as string) || "Unassigned";
    const value = (meta?.odoo_revenue as number) || lead.expected_value || 0;
    const prob = lead.probability || 0;
    totalValue += value;
    weightedValue += value * prob / 100;

    if (!bySalesperson[sp]) bySalesperson[sp] = { total: 0, stale: 0, value: 0 };
    bySalesperson[sp].total += 1;
    bySalesperson[sp].value += value;

    const daysSince = differenceInDays(new Date(), new Date(lead.updated_at));
    if (daysSince >= 5 && lead.stage !== "won" && lead.stage !== "lost") {
      staleCount++;
      bySalesperson[sp].stale += 1;
    }
  });

  return { total: leads.length, byStage, bySalesperson, staleCount, totalValue, weightedValue };
}

export function PipelineAISheet({ open, onOpenChange, leads }: PipelineAISheetProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState("");

  const runAction = async (actionId: string, customMessage?: string) => {
    setLoading(true);
    setResult(null);
    try {
      const stats = buildPipelineStats(leads);
      const { data, error } = await supabase.functions.invoke("pipeline-ai", {
        body: { action: "pipeline_audit", pipelineStats: stats, auditType: actionId, userMessage: customMessage },
      });
      if (error) throw error;
      setResult(data?.answer || data?.report || JSON.stringify(data));
    } catch (err) {
      console.error("Pipeline AI error:", err);
      setResult("⚠️ Failed to get AI analysis. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    if (!userMessage.trim()) return;
    const msg = userMessage;
    setUserMessage("");
    runAction("custom_question", msg);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <div className="p-6 pb-4 border-b border-border shrink-0">
          <SheetHeader className="text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold">Blitz — Sales Command</SheetTitle>
                <p className="text-xs text-muted-foreground">AI-powered pipeline accountability</p>
              </div>
            </div>
          </SheetHeader>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <Badge variant="secondary" className="gap-1 text-xs">
              <Target className="w-3 h-3" /> {leads.length} leads
            </Badge>
            <Badge variant="outline" className="gap-1 text-xs text-destructive border-destructive/30">
              <AlertTriangle className="w-3 h-3" /> {buildPipelineStats(leads).staleCount} stale
            </Badge>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-6 py-4 border-b border-border shrink-0">
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                className="justify-start gap-2 h-auto py-2.5 px-3"
                disabled={loading}
                onClick={() => runAction(action.id)}
              >
                <action.icon className="w-4 h-4 shrink-0 text-primary" />
                <div className="text-left">
                  <div className="text-xs font-medium">{action.label}</div>
                  <div className="text-[10px] text-muted-foreground">{action.desc}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Response Area */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : result ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Ask Blitz anything about your pipeline</p>
                <p className="text-xs mt-1">Or use a quick action above to get started</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-border shrink-0">
          <div className="flex gap-2">
            <Textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="Ask Blitz about your pipeline..."
              className="min-h-[44px] max-h-[100px] text-sm resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
            />
            <Button size="icon" onClick={handleSend} disabled={loading || !userMessage.trim()} className="shrink-0 h-[44px] w-[44px]">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
