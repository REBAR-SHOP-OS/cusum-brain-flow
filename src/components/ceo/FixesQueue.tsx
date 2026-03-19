import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  RefreshCw, Sparkles, Clock,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

interface ParsedFix {
  agentName: string;
  problem: string;
  fix: string;
  file: string;
  fullCommand: string;
}

/** Extract all LOVABLE COMMAND blocks from an audit report */
function parseLovableCommands(report: string): ParsedFix[] {
  const fixes: ParsedFix[] = [];
  // Match ```LOVABLE COMMAND:...``` blocks
  const regex = /```[\s\S]*?LOVABLE COMMAND:\s*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(report)) !== null) {
    const block = match[1].trim();
    const fullCommand = `LOVABLE COMMAND:\n${block}`;

    // Parse structured fields
    const agentMatch = block.match(/Fix the (.+?) agent prompt/i);
    const problemMatch = block.match(/PROBLEM:\s*(.+?)(?:\n|$)/i);
    const fixMatch = block.match(/FIX:\s*([\s\S]*?)(?=\nFILE:|DO NOT|$)/i);
    const fileMatch = block.match(/FILE:\s*(.+?)(?:\n|$)/i);

    fixes.push({
      agentName: agentMatch?.[1]?.trim() || "Unknown Agent",
      problem: problemMatch?.[1]?.trim() || "See full command",
      fix: fixMatch?.[1]?.trim() || "",
      file: fileMatch?.[1]?.trim() || "",
      fullCommand,
    });
  }

  return fixes;
}

interface AuditRecord {
  id: string;
  content: string;
  created_at: string;
  metadata: { date?: string; agents_audited?: string[] } | null;
}

export function FixesQueue() {
  const { user } = useAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: audits, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["vizzy-audit-fixes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vizzy_memory")
        .select("id, content, created_at, metadata")
        .eq("category", "agent_audit")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as AuditRecord[];
    },
  });

  // Flatten all fixes from all audits
  const allFixes: (ParsedFix & { auditId: string; auditDate: string })[] = [];
  audits?.forEach((audit) => {
    const fixes = parseLovableCommands(audit.content);
    fixes.forEach((f) =>
      allFixes.push({ ...f, auditId: audit.id, auditDate: audit.created_at })
    );
  });

  const handleCopy = async (fix: ParsedFix & { auditId: string }, idx: number) => {
    const key = `${fix.auditId}-${idx}`;
    try {
      await navigator.clipboard.writeText(fix.fullCommand);
      setCopiedId(key);
      toast({ title: "Copied!", description: "Paste this into the Lovable chat to apply the fix." });
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      toast({ title: "Copy failed", description: "Please select and copy manually.", variant: "destructive" });
    }
  };

  const handleCopyAll = async () => {
    if (!allFixes.length) return;
    const combined = allFixes.map((f) => f.fullCommand).join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(combined);
      setCopiedId("all");
      toast({ title: "All fixes copied!", description: `${allFixes.length} commands ready to paste.` });
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
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
            {allFixes.length} pending
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {allFixes.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAll}
              className="text-xs gap-1.5"
            >
              {copiedId === "all" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Copy All
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {allFixes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No pending fixes</p>
            <p className="text-xs mt-1">
              Vizzy will populate fixes here after agent audits.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {allFixes.map((fix, idx) => {
              const key = `${fix.auditId}-${idx}`;
              const isExpanded = expandedId === key;
              return (
                <div
                  key={key}
                  className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden"
                >
                  {/* Header row */}
                  <div className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs font-semibold capitalize">
                          {fix.agentName}
                        </Badge>
                        {fix.file && (
                          <span className="text-[10px] text-muted-foreground font-mono truncate">
                            {fix.file}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">
                        {fix.problem}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(parseISO(fix.auditDate), { addSuffix: true })}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setExpandedId(isExpanded ? null : key)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => handleCopy(fix, idx)}
                      >
                        {copiedId === key ? (
                          <><Check className="w-3.5 h-3.5" /> Copied</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" /> Copy</>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded view */}
                  {isExpanded && (
                    <div className="border-t border-border/40 bg-muted/30 p-3">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/80 max-h-60 overflow-y-auto">
                        {fix.fullCommand}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
