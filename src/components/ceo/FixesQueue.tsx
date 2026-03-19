import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Wrench, Copy, Check, ChevronDown, ChevronUp,
  RefreshCw, Sparkles, Clock, CheckCircle2, MessageSquare,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ParsedFix {
  agentName: string;
  problem: string;
  fix: string;
  file: string;
  fullCommand: string;
}

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

  // If no ```LOVABLE COMMAND blocks found, try raw LOVABLE COMMAND: blocks
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

export function FixesQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showApplied, setShowApplied] = useState(false);

  const { data: audits, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["vizzy-fixes-queue", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vizzy_memory")
        .select("id, content, created_at, category, metadata")
        .in("category", ["agent_audit", "feedback_fix"])
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as AuditRecord[];
    },
  });

  // Flatten fixes
  const allFixes: FixItem[] = [];
  audits?.forEach((audit) => {
    const fixes = parseLovableCommands(audit.content);
    const applied = !!(audit.metadata as any)?.applied;
    fixes.forEach((f) =>
      allFixes.push({
        ...f,
        auditId: audit.id,
        auditDate: audit.created_at,
        category: audit.category,
        applied,
      })
    );
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
            {pendingFixes.length} pending
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
        {pendingFixes.length === 0 && appliedFixes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No pending fixes</p>
            <p className="text-xs mt-1">Vizzy will populate fixes here after agent audits and feedback analysis.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Pending fixes */}
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

            {/* Applied section */}
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
