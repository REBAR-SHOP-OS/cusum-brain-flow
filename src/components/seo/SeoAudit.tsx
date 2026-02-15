import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Play, ChevronDown, CheckSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

const severityColor: Record<string, string> = {
  critical: "text-destructive bg-destructive/10",
  warning: "text-yellow-600 bg-yellow-500/10",
  info: "text-blue-500 bg-blue-500/10",
};

export function SeoAudit() {
  const qc = useQueryClient();
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const { data: domain } = useQuery({
    queryKey: ["seo-domain"],
    queryFn: async () => {
      const { data } = await supabase.from("seo_domains").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: crawlRuns, isLoading } = useQuery({
    queryKey: ["seo-crawl-runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_crawl_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const { data: runIssues } = useQuery({
    queryKey: ["seo-run-issues", expandedRun],
    enabled: !!expandedRun,
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_issues")
        .select("*")
        .eq("crawl_run_id", expandedRun!)
        .order("severity")
        .limit(200);
      return data || [];
    },
  });

  const runCrawl = useMutation({
    mutationFn: async () => {
      if (!domain?.id) throw new Error("No domain configured");
      const { data, error } = await supabase.functions.invoke("seo-site-crawl", {
        body: { domain_id: domain.id, max_pages: 100 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["seo-crawl-runs"] });
      qc.invalidateQueries({ queryKey: ["seo-latest-crawl"] });
      toast.success(`Crawl complete: ${data.pages_crawled} pages, score ${data.health_score}/100`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createTask = useMutation({
    mutationFn: async (issue: any) => {
      if (!domain) throw new Error("No domain");
      const { error } = await supabase.from("seo_tasks").insert({
        domain_id: domain.id,
        title: issue.title,
        description: issue.description,
        priority: issue.severity === "critical" ? "high" : "medium",
        entity_url: issue.page_url,
        entity_type: "page",
        linked_issue_id: issue.id,
        company_id: domain.company_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seo-tasks"] });
      toast.success("Task created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Site Audit</h1>
          <p className="text-sm text-muted-foreground">Crawl your site to detect SEO issues</p>
        </div>
        <Button onClick={() => runCrawl.mutate()} disabled={runCrawl.isPending || !domain}>
          {runCrawl.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Crawling...</> : <><Play className="w-4 h-4 mr-1" /> Run Crawl</>}
        </Button>
      </div>

      {!domain && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No domain configured yet. Add a domain from the Overview page to start auditing.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-3">
          {crawlRuns?.map((run: any) => {
            const isExpanded = expandedRun === run.id;
            return (
              <Collapsible key={run.id} open={isExpanded} onOpenChange={() => setExpandedRun(isExpanded ? null : run.id)}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-sm font-medium">
                            {new Date(run.started_at).toLocaleDateString()} {new Date(run.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </CardTitle>
                          <Badge variant={run.status === "completed" ? "default" : run.status === "running" ? "secondary" : "destructive"}>
                            {run.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span>{run.pages_crawled} pages</span>
                          <span className="font-bold">Score: {run.health_score}/100</span>
                          <div className="flex gap-1">
                            {run.issues_critical > 0 && <Badge className={severityColor.critical}>{run.issues_critical} critical</Badge>}
                            {run.issues_warning > 0 && <Badge className={severityColor.warning}>{run.issues_warning} warning</Badge>}
                            {run.issues_info > 0 && <Badge className={severityColor.info}>{run.issues_info} info</Badge>}
                          </div>
                          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {!runIssues?.length ? (
                        <p className="text-sm text-muted-foreground py-4">No issues found — great job!</p>
                      ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {runIssues.map((issue: any) => (
                            <div key={issue.id} className="flex items-start justify-between gap-2 p-2 rounded border bg-muted/20">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge className={`text-[10px] ${severityColor[issue.severity] || ""}`}>{issue.severity}</Badge>
                                  <span className="text-sm font-medium">{issue.title}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{issue.description}</p>
                                {issue.page_url && <p className="text-xs text-muted-foreground truncate mt-0.5">{issue.page_url}</p>}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="shrink-0 text-xs"
                                onClick={(e) => { e.stopPropagation(); createTask.mutate(issue); }}
                              >
                                <CheckSquare className="w-3 h-3 mr-1" /> Task
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
          {!crawlRuns?.length && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No crawl runs yet. Click "Run Crawl" to start.</CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}
