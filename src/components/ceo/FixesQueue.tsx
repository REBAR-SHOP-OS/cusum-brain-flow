import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Wrench, Copy, Check, ChevronDown, ChevronUp,
  RefreshCw, Sparkles, Clock, CheckCircle2, MessageSquare,
  HelpCircle, UserPlus, Send, ArrowRight,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// ── Types ──

interface ParsedFix {
  agentName: string;
  problem: string;
  fix: string;
  file: string;
  fullCommand: string;
}

interface AuditRecord {
  id: string;
  content: string;
  created_at: string;
  category: string;
  metadata: Record<string, any> | null;
}

type FixItem = ParsedFix & {
  auditId: string;
  auditDate: string;
  category: string;
  applied: boolean;
};

interface ClarificationItem {
  id: string;
  title: string;
  questions: string[];
  reasoning: string;
  recommended_person: string;
  created_at: string;
  metadata: Record<string, any>;
}

interface EscalationItem {
  id: string;
  title: string;
  reasoning: string;
  assigned_to: string;
  department: string;
  created_at: string;
}

// ── Helpers ──

function parseLovableCommands(report: string): ParsedFix[] {
  const fixes: ParsedFix[] = [];
  const regex = /```[\s\S]*?LOVABLE COMMAND:\s*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(report)) !== null) {
    const block = match[1].trim();
    const fullCommand = `LOVABLE COMMAND:\n${block}`;
    const agentMatch = block.match(/Fix the (.+?) agent prompt/i) || block.match(/Fix the (.+?) /i);
    const problemMatch = block.match(/PROBLEM:\s*(.+?)(?:\n|$)/i);
    const fixMatch = block.match(/FIX:\s*([\s\S]*?)(?=\nFILE:|DO NOT|$)/i);
    const fileMatch = block.match(/FILE:\s*(.+?)(?:\n|$)/i);

    fixes.push({
      agentName: agentMatch?.[1]?.trim() || "Unknown",
      problem: problemMatch?.[1]?.trim() || "See full command",
      fix: fixMatch?.[1]?.trim() || "",
      file: fileMatch?.[1]?.trim() || "",
      fullCommand,
    });
  }

  if (fixes.length === 0 && report.includes("LOVABLE COMMAND:")) {
    const rawBlock = report.trim();
    const problemMatch = rawBlock.match(/PROBLEM:\s*(.+?)(?:\n|$)/i);
    const fileMatch = rawBlock.match(/FILE:\s*(.+?)(?:\n|$)/i);
    const agentMatch = rawBlock.match(/Fix the (.+?) /i);

    fixes.push({
      agentName: agentMatch?.[1]?.trim() || "Feedback",
      problem: problemMatch?.[1]?.trim() || "See full command",
      fix: "",
      file: fileMatch?.[1]?.trim() || "",
      fullCommand: rawBlock,
    });
  }

  return fixes;
}

// ── Main Component ──

export function FixesQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showApplied, setShowApplied] = useState(false);
  const [showEscalated, setShowEscalated] = useState(false);

  const { data: audits, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["vizzy-fixes-queue", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vizzy_memory")
        .select("id, content, created_at, category, metadata")
        .in("category", ["agent_audit", "feedback_fix", "feedback_clarification", "feedback_escalation"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as AuditRecord[];
    },
  });

  // ── Categorize records ──
  const allFixes: FixItem[] = [];
  const clarifications: ClarificationItem[] = [];
  const escalations: EscalationItem[] = [];

  audits?.forEach((audit) => {
    const meta = (audit.metadata || {}) as Record<string, any>;

    if (audit.category === "feedback_clarification") {
      clarifications.push({
        id: audit.id,
        title: meta.source_title || "Untitled feedback",
        questions: (meta.questions as string[]) || [],
        reasoning: audit.content || meta.reasoning || "",
        recommended_person: meta.recommended_person || "",
        created_at: audit.created_at,
        metadata: meta,
      });
    } else if (audit.category === "feedback_escalation") {
      escalations.push({
        id: audit.id,
        title: meta.source_title || "Untitled feedback",
        reasoning: audit.content || meta.reasoning || "",
        assigned_to: meta.recommended_person || "Unknown",
        department: meta.recommended_department || "",
        created_at: audit.created_at,
      });
    } else {
      // agent_audit or feedback_fix
      const fixes = parseLovableCommands(audit.content);
      const applied = !!meta.applied;
      fixes.forEach((f) =>
        allFixes.push({
          ...f,
          auditId: audit.id,
          auditDate: audit.created_at,
          category: audit.category,
          applied,
        })
      );
    }
  });

  const pendingFixes = allFixes.filter((f) => !f.applied);
  const appliedFixes = allFixes.filter((f) => f.applied);

  const handleCopy = async (fix: FixItem, idx: number) => {
    const key = `${fix.auditId}-${idx}`;
    try {
      await navigator.clipboard.writeText(fix.fullCommand);
      setCopiedId(key);
      toast({ title: "Copied!", description: "Paste this into the Lovable chat to apply the fix." });
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleCopyAll = async () => {
    if (!pendingFixes.length) return;
    const combined = pendingFixes.map((f) => f.fullCommand).join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(combined);
      setCopiedId("all");
      toast({ title: "All fixes copied!", description: `${pendingFixes.length} commands ready to paste.` });
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleMarkApplied = async (auditId: string) => {
    try {
      const audit = audits?.find((a) => a.id === auditId);
      const updatedMeta = { ...(audit?.metadata || {}), applied: true, applied_at: new Date().toISOString() };
      const { error } = await supabase
        .from("vizzy_memory")
        .update({ metadata: updatedMeta } as any)
        .eq("id", auditId);
      if (error) throw error;
      toast({ title: "✅ Marked as applied" });
      queryClient.invalidateQueries({ queryKey: ["vizzy-fixes-queue"] });
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    }
  };

  const totalPending = pendingFixes.length + clarifications.length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">Vizzy Fixes Queue</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {totalPending} pending
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {pendingFixes.length > 1 && (
            <Button variant="outline" size="sm" onClick={handleCopyAll} className="text-xs gap-1.5">
              {copiedId === "all" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Copy All
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {totalPending === 0 && appliedFixes.length === 0 && escalations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No pending fixes</p>
            <p className="text-xs mt-1">Vizzy will populate fixes here after agent audits and feedback analysis.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* ── Clarification cards (yellow) ── */}
            {clarifications.map((item) => (
              <ClarificationCard
                key={item.id}
                item={item}
                onResolved={() => queryClient.invalidateQueries({ queryKey: ["vizzy-fixes-queue"] })}
              />
            ))}

            {/* ── Pending fix cards ── */}
            {pendingFixes.map((fix, idx) => (
              <FixCard
                key={`${fix.auditId}-${idx}`}
                fix={fix}
                idx={idx}
                copiedId={copiedId}
                expandedId={expandedId}
                onCopy={() => handleCopy(fix, idx)}
                onToggle={() => setExpandedId(expandedId === `${fix.auditId}-${idx}` ? null : `${fix.auditId}-${idx}`)}
                onMarkApplied={() => handleMarkApplied(fix.auditId)}
              />
            ))}

            {/* ── Escalated section (purple) ── */}
            {escalations.length > 0 && (
              <Collapsible open={showEscalated} onOpenChange={setShowEscalated}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground gap-1.5">
                    {showEscalated ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <UserPlus className="w-3.5 h-3.5 text-purple-500" />
                    {escalations.length} escalated to team
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {escalations.map((item) => (
                    <EscalationCard key={item.id} item={item} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* ── Applied section ── */}
            {appliedFixes.length > 0 && (
              <Collapsible open={showApplied} onOpenChange={setShowApplied}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground gap-1.5">
                    {showApplied ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {appliedFixes.length} applied
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {appliedFixes.map((fix, idx) => (
                    <FixCard
                      key={`applied-${fix.auditId}-${idx}`}
                      fix={fix}
                      idx={idx}
                      copiedId={copiedId}
                      expandedId={expandedId}
                      onCopy={() => handleCopy(fix, idx)}
                      onToggle={() => setExpandedId(expandedId === `applied-${fix.auditId}-${idx}` ? null : `applied-${fix.auditId}-${idx}`)}
                      applied
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Clarification Card (Yellow) ──

function ClarificationCard({
  item,
  onResolved,
}: {
  item: ClarificationItem;
  onResolved: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("analyze-feedback-fix", {
        body: {
          title: item.title,
          description: item.metadata.source_description || "",
          screenshot_url: item.metadata.screenshot_url || undefined,
          page_path: item.metadata.page_path || undefined,
          clarification_answer: answer.trim(),
          original_memory_id: item.id,
        },
      });
      if (error) throw error;
      toast({ title: "✅ Answer submitted", description: "Re-analyzing with your input..." });
      setAnswer("");
      onResolved();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleRouteToTeam = async () => {
    setSending(true);
    try {
      // Update category to escalation
      const updatedMeta = {
        ...item.metadata,
        escalated_by_ceo: true,
        escalated_at: new Date().toISOString(),
      };
      await supabase
        .from("vizzy_memory")
        .update({ category: "feedback_escalation", metadata: updatedMeta } as any)
        .eq("id", item.id);
      toast({ title: "📋 Routed to team", description: `Assigned to ${item.recommended_person || "team"}` });
      onResolved();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 overflow-hidden">
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="w-4 h-4 text-yellow-600" />
          <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-700">
            Needs Clarification
          </Badge>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {formatDistanceToNow(parseISO(item.created_at), { addSuffix: true })}
          </span>
        </div>

        <p className="text-sm font-medium text-foreground mb-2">{item.title}</p>

        {item.reasoning && (
          <p className="text-xs text-muted-foreground mb-2 italic">{item.reasoning}</p>
        )}

        {item.questions.length > 0 && (
          <div className="space-y-1 mb-3">
            {item.questions.map((q, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                <span className="font-semibold text-yellow-700 shrink-0">{i + 1}.</span>
                <span>{q}</span>
              </div>
            ))}
          </div>
        )}

        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer here..."
          className="text-xs min-h-[60px] mb-2 bg-background/50"
        />

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="text-xs gap-1.5 flex-1"
            onClick={handleSubmitAnswer}
            disabled={!answer.trim() || sending}
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "Analyzing..." : "Submit Answer"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 text-purple-600 border-purple-500/40 hover:bg-purple-500/10"
            onClick={handleRouteToTeam}
            disabled={sending}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            Route to {item.recommended_person || "Team"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Escalation Card (Purple) ──

function EscalationCard({ item }: { item: EscalationItem }) {
  return (
    <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <UserPlus className="w-4 h-4 text-purple-600" />
        <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-700">
          Escalated → {item.assigned_to}
        </Badge>
        {item.department && (
          <span className="text-[10px] text-muted-foreground capitalize">{item.department}</span>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto">
          {formatDistanceToNow(parseISO(item.created_at), { addSuffix: true })}
        </span>
      </div>
      <p className="text-sm text-foreground mb-1">{item.title}</p>
      <p className="text-xs text-muted-foreground">{item.reasoning}</p>
    </div>
  );
}

// ── Fix Card ──

function FixCard({
  fix,
  idx,
  copiedId,
  expandedId,
  onCopy,
  onToggle,
  onMarkApplied,
  applied,
}: {
  fix: FixItem;
  idx: number;
  copiedId: string | null;
  expandedId: string | null;
  onCopy: () => void;
  onToggle: () => void;
  onMarkApplied?: () => void;
  applied?: boolean;
}) {
  const key = applied ? `applied-${fix.auditId}-${idx}` : `${fix.auditId}-${idx}`;
  const isExpanded = expandedId === key;
  const isCopied = copiedId === key;
  const isFeedback = fix.category === "feedback_fix";

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      applied ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/60 bg-muted/20"
    )}>
      <div className="flex items-center gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-semibold capitalize",
                isFeedback && "border-blue-500/50 text-blue-600"
              )}
            >
              {isFeedback ? <><MessageSquare className="w-3 h-3 mr-1" />Feedback</> : fix.agentName}
            </Badge>
            {fix.file && (
              <span className="text-[10px] text-muted-foreground font-mono truncate">{fix.file}</span>
            )}
            {applied && (
              <Badge variant="secondary" className="text-[10px] gap-1 text-emerald-600">
                <CheckCircle2 className="w-3 h-3" /> Applied
              </Badge>
            )}
          </div>
          <p className="text-sm text-foreground line-clamp-2">{fix.problem}</p>
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(parseISO(fix.auditDate), { addSuffix: true })}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          {!applied && onMarkApplied && (
            <Button variant="outline" size="sm" className="text-xs gap-1 text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10" onClick={onMarkApplied}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Applied
            </Button>
          )}
          <Button size="sm" className="gap-1.5 text-xs" onClick={onCopy}>
            {isCopied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border/40 bg-muted/30 p-3">
          <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/80 max-h-60 overflow-y-auto">
            {fix.fullCommand}
          </pre>
        </div>
      )}
    </div>
  );
}
