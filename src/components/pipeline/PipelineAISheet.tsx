import { useState, useEffect, useRef, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp, AlertTriangle, Clock, BarChart3, Send,
  Users, Target, Sparkles, Mail, DollarSign, ListChecks, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RichMarkdown } from "@/components/chat/RichMarkdown";
import type { Tables } from "@/integrations/supabase/types";
import { differenceInDays } from "date-fns";
import salesHelper from "@/assets/helpers/sales-helper.png";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface PipelineAISheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: LeadWithCustomer[];
}

const checkingPhases = [
  { label: "Scanning pipeline activity...", Icon: TrendingUp },
  { label: "Reviewing lead emails...", Icon: Mail },
  { label: "Prioritizing your actions...", Icon: ListChecks },
];

const POST_BRIEFING_ACTIONS = [
  { id: "stale_report", label: "Stale Leads" },
  { id: "followup_gaps", label: "Follow-up Gaps" },
  { id: "revenue_forecast", label: "Revenue Forecast" },
  { id: "salesperson_report", label: "Team Ranking" },
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
  const [messages, setMessages] = useState<{ role: "user" | "agent"; content: string }[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [checkingPhase, setCheckingPhase] = useState(0);
  const hasAutoFired = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const userName = useMemo(() => {
    const full = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
    return full.split(" ")[0];
  }, [user]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Checking-phase animation while loading with no messages
  useEffect(() => {
    if (!loading || messages.length > 0) return;
    setCheckingPhase(0);
    const interval = setInterval(() => {
      setCheckingPhase((prev) => (prev + 1) % checkingPhases.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [loading, messages.length]);

  // Auto-fire briefing when sheet opens with leads
  useEffect(() => {
    if (!open || hasAutoFired.current || leads.length === 0) return;
    hasAutoFired.current = true;
    runBriefing();
  }, [open, leads.length]);

  // Reset when sheet closes
  useEffect(() => {
    if (!open) {
      // Keep messages but allow re-briefing next time
      // hasAutoFired stays true so it doesn't re-fire on same session
    }
  }, [open]);

  const runBriefing = async () => {
    setLoading(true);
    try {
      const stats = buildPipelineStats(leads);
      const today = new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

      const briefingPrompt = `Daily sales pipeline briefing for ${userName}. Today is ${today}.

Pipeline stats: ${JSON.stringify(stats)}

FORMAT REQUIREMENTS — follow exactly:
1. Start with "🔥 X items need your attention" (count real action items)
2. Warm one-liner greeting for ${userName}

3. **🚨 URGENT — Act Now**: Stale leads (5+ days no activity), high-value deals at risk. Use a table: | # | Lead/Deal | Salesperson | Value | Days Stale | Action |
4. **📅 TODAY — Follow Up**: Leads needing same-day follow-up, quotations to send. Numbered list with tags [Pipeline] [Email] [Quotation]
5. **📋 THIS WEEK — Upcoming**: Deals expected to close this week, upcoming meetings. Numbered list
6. **👥 Team Pulse**: One-line per salesperson: name, active leads, stale count, pipeline value
7. **✅ Bottom Line**: "Pipeline is healthy" OR "X deals at risk — start with #1"

RULES:
- Tag items: [Pipeline], [Email], [Quotation], [Follow-up]
- Bold all dollar amounts
- SHORT sentences — max 15 words
- If 0 stale leads, say "✅ No stale leads — team is on it!"
- Be direct and accountability-focused`;

      const { data, error } = await supabase.functions.invoke("pipeline-ai", {
        body: { action: "pipeline_audit", pipelineStats: stats, auditType: "pipeline_audit", userMessage: briefingPrompt },
      });
      if (error) throw error;
      const reply = data?.answer || data?.report || JSON.stringify(data);
      setMessages([{ role: "agent", content: reply }]);
    } catch (err) {
      console.error("Blitz auto-briefing error:", err);
      setMessages([{ role: "agent", content: "⚠️ Failed to load briefing. Try a quick action below." }]);
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (actionId: string, customMessage?: string) => {
    const userContent = customMessage || actionId.replace(/_/g, " ");
    setMessages((prev) => [...prev, { role: "user", content: userContent }]);
    setLoading(true);
    try {
      const stats = buildPipelineStats(leads);
      const { data, error } = await supabase.functions.invoke("pipeline-ai", {
        body: { action: "pipeline_audit", pipelineStats: stats, auditType: actionId, userMessage: customMessage },
      });
      if (error) throw error;
      const reply = data?.answer || data?.report || JSON.stringify(data);
      setMessages((prev) => [...prev, { role: "agent", content: reply }]);
    } catch (err) {
      console.error("Blitz error:", err);
      setMessages((prev) => [...prev, { role: "agent", content: "⚠️ Failed to get analysis. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    if (!userMessage.trim() || loading) return;
    const msg = userMessage;
    setUserMessage("");
    runAction("custom_question", msg);
  };

  const stats = useMemo(() => buildPipelineStats(leads), [leads]);
  const briefingLoaded = messages.length === 1 && messages[0]?.role === "agent" && !loading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        {/* Header */}
        <div className="p-4 pb-3 border-b border-border shrink-0">
          <SheetHeader className="text-left">
            <div className="flex items-center gap-3">
              <img src={salesHelper} alt="Blitz" className="w-10 h-10 rounded-xl object-cover" />
              <div>
                <SheetTitle className="text-lg font-bold flex items-center gap-2">
                  Blitz
                  <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Sales Command</span>
                </SheetTitle>
                <p className="text-xs text-muted-foreground">Pipeline accountability partner</p>
              </div>
            </div>
          </SheetHeader>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge variant="secondary" className="gap-1 text-xs">
              <Target className="w-3 h-3" /> {stats.total} leads
            </Badge>
            <Badge variant="outline" className="gap-1 text-xs text-destructive border-destructive/30">
              <AlertTriangle className="w-3 h-3" /> {stats.staleCount} stale
            </Badge>
            <Badge variant="outline" className="gap-1 text-xs">
              <DollarSign className="w-3 h-3" /> ${Math.round(stats.totalValue / 1000)}k pipeline
            </Badge>
          </div>
        </div>

        {/* Messages / Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-3">
            {/* Checking animation — no messages yet, loading */}
            {messages.length === 0 && loading && (
              <div className="flex flex-col items-center justify-center py-12 gap-5">
                <img src={salesHelper} alt="Blitz" className="w-14 h-14 rounded-2xl object-cover" />
                <div className="space-y-3 w-full max-w-xs">
                  {checkingPhases.map((phase, idx) => {
                    const isActive = idx === checkingPhase;
                    const isDone = idx < checkingPhase;
                    return (
                      <div
                        key={phase.label}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-500",
                          isActive ? "bg-primary/10 scale-[1.02]" : isDone ? "bg-muted/60 opacity-60" : "opacity-30"
                        )}
                      >
                        <phase.Icon className={cn(
                          "w-4 h-4 shrink-0 transition-all duration-300",
                          isActive ? "text-primary animate-pulse" : isDone ? "text-muted-foreground" : "text-muted-foreground/40"
                        )} />
                        <span className={cn(
                          "text-sm transition-all duration-300",
                          isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                        )}>
                          {phase.label}
                        </span>
                        {isDone && <span className="ml-auto text-xs text-primary">✓</span>}
                        {isActive && <Loader2 className="ml-auto w-3.5 h-3.5 animate-spin text-primary" />}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground animate-pulse mt-2">Building your priority list...</p>
              </div>
            )}

            {/* Empty state — only if not loading and no messages */}
            {messages.length === 0 && !loading && (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Ask Blitz anything about your pipeline</p>
                <p className="text-xs mt-1">Or use a quick action below</p>
              </div>
            )}

            {/* Rendered messages */}
            {messages.map((msg, idx) => (
              <div key={idx} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "agent" && (
                  <img src={salesHelper} alt="Blitz" className="w-7 h-7 rounded-lg object-cover shrink-0 mt-1" />
                )}
                <div className={cn(
                  "rounded-xl px-3 py-2 text-sm overflow-x-auto",
                  msg.role === "user"
                    ? "max-w-[85%] bg-primary text-primary-foreground"
                    : "max-w-[90%] bg-muted"
                )}>
                  {msg.role === "agent" ? (
                    <RichMarkdown content={msg.content} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {/* Post-briefing quick actions */}
            {briefingLoaded && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {POST_BRIEFING_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => runAction(action.id)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Loading indicator for follow-up messages */}
            {loading && messages.length > 0 && (
              <div className="flex items-center gap-2">
                <img src={salesHelper} alt="Blitz" className="w-7 h-7 rounded-lg object-cover" />
                <div className="bg-muted rounded-xl px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Blitz is analyzing...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t border-border shrink-0">
          <div className="flex gap-2">
            <Textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="Ask Blitz about leads, deals, follow-ups..."
              className="min-h-[40px] max-h-[100px] text-sm resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
            />
            <Button size="icon" onClick={handleSend} disabled={loading || !userMessage.trim()} className="shrink-0 h-[40px] w-[40px]">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
