import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Link2, ExternalLink, AlertTriangle, CheckCircle, Loader2, Sparkles, RefreshCw, Globe, Eye, Brain } from "lucide-react";
import { toast } from "sonner";
import { useSemrushSync } from "@/hooks/useSemrushApi";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

type StatusFilter = "all" | "broken" | "opportunity" | "fixed" | "backlinks";

interface Proposal {
  id: string;
  type?: "opportunity" | "broken";
  action?: string;
  replacement_url?: string;
  before_paragraph?: string;
  after_paragraph?: string;
  reasoning?: string;
  error?: string;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-green-500/10 text-green-600" },
  checked: { label: "OK", className: "bg-green-500/10 text-green-600" },
  broken: { label: "Broken", className: "bg-destructive/10 text-destructive" },
  missing_anchor: { label: "Missing Anchor", className: "bg-yellow-500/10 text-yellow-600" },
  nofollow_issue: { label: "Nofollow", className: "bg-orange-500/10 text-orange-600" },
  opportunity: { label: "RSIC Opportunity", className: "bg-primary/10 text-primary" },
};

const typeBadge: Record<string, { label: string; className: string }> = {
  internal: { label: "Internal", className: "bg-blue-500/10 text-blue-600" },
  external: { label: "External", className: "bg-purple-500/10 text-purple-600" },
  rsic_opportunity: { label: "RSIC", className: "bg-primary/10 text-primary" },
};

export function SeoLinks() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [pendingFixIds, setPendingFixIds] = useState<string[]>([]);
  const qc = useQueryClient();
  const { fetchBacklinks } = useSemrushSync();

  const { data: domain } = useQuery({
    queryKey: ["seo-domain"],
    queryFn: async () => {
      const { data } = await supabase.from("seo_domains").select("*").limit(1).single();
      return data;
    },
  });

  const { data: audits, isLoading } = useQuery({
    queryKey: ["seo-link-audits", domain?.id],
    queryFn: async () => {
      if (!domain?.id) return [];
      const { data } = await supabase
        .from("seo_link_audit")
        .select("*")
        .eq("domain_id", domain.id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!domain?.id,
  });

  const crawlMutation = useMutation({
    mutationFn: async () => {
      if (!domain) throw new Error("No domain configured");

      // Phase 1: Crawl all pages and extract links
      toast.info("Phase 1/2: Extracting links from all pages...");
      await invokeEdgeFunction("seo-link-audit", {
        phase: "crawl",
        domain_id: domain.id,
        company_id: domain.company_id,
      }, { timeoutMs: 120000 });

      // Phase 2: Check external links for broken status (iterative)
      toast.info("Phase 2/2: Checking external links...");
      let remaining = 1;
      let totalBroken = 0;
      let iterations = 0;
      while (remaining > 0 && iterations < 50) {
        const checkResult = await invokeEdgeFunction<{ broken: number; remaining: number }>("seo-link-audit", {
          phase: "check_broken",
          domain_id: domain.id,
        }, { timeoutMs: 60000 });
        totalBroken += checkResult.broken || 0;
        remaining = checkResult.remaining || 0;
        iterations++;
      }

      return { totalBroken };
    },
    onSuccess: (data) => {
      toast.success(`Audit complete! Found ${data.totalBroken} broken links.`);
      qc.invalidateQueries({ queryKey: ["seo-link-audits"] });
    },
    onError: (e) => toast.error(`Crawl failed: ${e.message}`),
  });

  // Preview mutation — gets AI proposals without applying (batched to 10)
  const previewMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!domain) throw new Error("No domain");
      return await invokeEdgeFunction<{ proposals: Proposal[]; total_requested: number; processed: number; remaining: number }>("seo-link-audit", {
        phase: "preview",
        audit_ids: ids,
        company_id: domain.company_id,
      }, { timeoutMs: 120000 });
    },
    onSuccess: (data, ids) => {
      setProposals(data.proposals || []);
      setPendingFixIds(ids);
      setPreviewOpen(true);
      if (data.remaining > 0) {
        toast.info(`Showing first ${data.processed} of ${data.total_requested} items. Run again for more.`);
      }
    },
    onError: (e) => toast.error(`Preview failed: ${e.message}`),
  });

  // Fix mutation — applies approved changes
  const fixMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!domain) throw new Error("No domain");
      return await invokeEdgeFunction("seo-link-audit", {
        phase: "fix",
        audit_ids: ids,
        company_id: domain.company_id,
      }, { timeoutMs: 120000 });
    },
    onSuccess: (data: any) => {
      toast.success(`Done — ${data.fixed || 0} fixes applied`);
      setPreviewOpen(false);
      setProposals([]);
      setPendingFixIds([]);
      qc.invalidateQueries({ queryKey: ["seo-link-audits"] });
    },
    onError: (e) => toast.error(`Fix failed: ${e.message}`),
  });

  const handleFixClick = (ids: string[]) => {
    // Cap to 10 client-side to match backend cap
    previewMutation.mutate(ids.slice(0, 10));
  };

  const handleApproveAll = () => {
    const validIds = proposals.filter(p => !p.error && p.before_paragraph && p.after_paragraph).map(p => p.id);
    if (validIds.length === 0) {
      toast.error("No valid proposals to apply");
      return;
    }
    fixMutation.mutate(validIds);
  };

  const filtered = (audits || []).filter((a: any) => {
    if (filter === "all") return true;
    if (filter === "broken") return a.status === "broken" || a.status === "missing_anchor";
    if (filter === "opportunity") return a.status === "opportunity";
    if (filter === "fixed") return a.is_fixed;
    return true;
  });

  const stats = {
    total: audits?.length || 0,
    broken: audits?.filter((a: any) => a.status === "broken").length || 0,
    opportunities: audits?.filter((a: any) => a.status === "opportunity").length || 0,
    fixed: audits?.filter((a: any) => a.is_fixed).length || 0,
  };

  const unfixedOpportunities = (audits || []).filter((a: any) => a.status === "opportunity" && !a.is_fixed).map((a: any) => a.id);
  const unfixedBroken = (audits || []).filter((a: any) => a.status === "broken" && !a.is_fixed).map((a: any) => a.id);

  const stripHtml = (html: string) => html?.replace(/<[^>]+>/g, "") || "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6 text-primary" />
            Link Audit
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Crawl all pages, find broken links, and add RSIC authority links
          </p>
        </div>
        <Button
          onClick={() => crawlMutation.mutate()}
          disabled={crawlMutation.isPending || !domain}
        >
          {crawlMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Run Link Audit
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Links</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Broken</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{stats.broken}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />RSIC Opportunities</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">{stats.opportunities}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Fixed</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{stats.fixed}</p></CardContent>
        </Card>
      </div>

      {/* Filters + Fix All */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="broken">Broken ({stats.broken})</TabsTrigger>
            <TabsTrigger value="opportunity">Opportunities ({stats.opportunities})</TabsTrigger>
            <TabsTrigger value="fixed">Fixed ({stats.fixed})</TabsTrigger>
            <TabsTrigger value="backlinks">
              <Globe className="w-3.5 h-3.5 mr-1" /> Backlinks
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          {unfixedBroken.length > 0 && filter === "broken" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFixClick(unfixedBroken)}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
              AI Fix Broken ({unfixedBroken.length})
            </Button>
          )}
          {unfixedOpportunities.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFixClick(unfixedOpportunities)}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              AI Fix Opportunities ({unfixedOpportunities.length})
            </Button>
          )}
        </div>
      </div>

      {/* Backlinks panel */}
      {filter === "backlinks" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" /> Backlink Overview (SEMrush API)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              onClick={() => domain && fetchBacklinks.mutate({ domain: domain.domain })}
              disabled={fetchBacklinks.isPending || !domain}
              className="mb-4"
            >
              {fetchBacklinks.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Fetch Backlinks
            </Button>
            {fetchBacklinks.data?.data && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Backlinks", value: Number(fetchBacklinks.data.data.total || 0).toLocaleString() },
                  { label: "Referring Domains", value: Number(fetchBacklinks.data.data.domains_num || 0).toLocaleString() },
                  { label: "Follow Links", value: Number(fetchBacklinks.data.data.follows_num || 0).toLocaleString() },
                  { label: "Nofollow Links", value: Number(fetchBacklinks.data.data.nofollows_num || 0).toLocaleString() },
                ].map((item) => (
                  <Card key={item.label}>
                    <CardContent className="py-4 text-center">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-2xl font-bold mt-1">{item.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {!fetchBacklinks.data && !fetchBacklinks.isPending && (
              <p className="text-sm text-muted-foreground">Click "Fetch Backlinks" to load data from SEMrush API.</p>
            )}
          </CardContent>
        </Card>
      ) : (
      /* Results table */
      isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {stats.total === 0 ? "No audit data yet. Run a link audit to crawl your site." : "No results match this filter."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Link / Suggestion</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Suggestion</TableHead>
                <TableHead className="w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((a: any) => {
                const sb = statusBadge[a.status] || { label: a.status, className: "" };
                const tb = typeBadge[a.link_type] || { label: a.link_type, className: "" };
                return (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      <a href={a.page_url} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary">
                        {new URL(a.page_url).pathname}
                      </a>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      {a.link_href ? (
                        <a href={a.link_href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          {a.anchor_text || a.link_href}
                        </a>
                      ) : (
                        <span className="text-muted-foreground italic">{a.suggested_anchor || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline" className={tb.className}>{tb.label}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={sb.className}>{sb.label}</Badge></TableCell>
                    <TableCell className="text-xs max-w-[250px] truncate">{a.suggestion || "—"}</TableCell>
                    <TableCell>
                      {a.is_fixed ? (
                        <Badge className="bg-green-500/10 text-green-600">Done</Badge>
                      ) : (a.status === "opportunity" || a.status === "broken") ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleFixClick([a.id])}
                          disabled={previewMutation.isPending}
                        >
                          {previewMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3 mr-1" />}
                          Preview Fix
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )
      )}

      {/* Preview/Confirm Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              AI Fix Preview
            </DialogTitle>
            <DialogDescription>
              Review the AI-proposed changes before applying them to your site.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {proposals.length === 0 && previewMutation.isPending && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                AI is analyzing your content...
              </div>
            )}
            {proposals.length > 0 && (() => {
              const errorCount = proposals.filter(p => !!p.error).length;
              const validCount = proposals.filter(p => !p.error && p.before_paragraph).length;
              return errorCount > 0 ? (
                <div className={`border rounded-lg p-4 text-sm ${errorCount === proposals.length ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700'}`}>
                  <p className="font-semibold mb-1">
                    {errorCount === proposals.length
                      ? `All ${errorCount} items failed to resolve`
                      : `${errorCount} of ${proposals.length} items failed — ${validCount} ready to apply`}
                  </p>
                  <p className="text-xs opacity-80">{proposals.find(p => p.error)?.error}. Try re-running the link audit to refresh WordPress page mappings.</p>
                </div>
              ) : null;
            })()}
            {proposals.map((p, i) => (
              <Card key={p.id} className="border-border">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Badge variant="outline" className={p.type === "broken" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}>
                      {p.type === "broken" ? `Broken Link Fix${p.action ? ` (${p.action})` : ""}` : "Opportunity Placement"}
                    </Badge>
                    {p.action === "replace" && p.replacement_url && (
                      <a href={p.replacement_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 max-w-[300px] truncate">
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        {p.replacement_url}
                      </a>
                    )}
                    {p.error && <Badge variant="destructive">Error</Badge>}
                  </div>

                  {p.error ? (
                    <p className="text-sm text-destructive">{p.error}</p>
                  ) : (
                    <>
                      {/* Before */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">BEFORE</p>
                        <div className="bg-destructive/5 border border-destructive/20 rounded p-3 text-xs leading-relaxed">
                          {stripHtml(p.before_paragraph || "")}
                        </div>
                      </div>

                      {/* After */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">AFTER</p>
                        <div className="bg-green-500/5 border border-green-500/20 rounded p-3 text-xs leading-relaxed">
                          {stripHtml(p.after_paragraph || "")}
                        </div>
                      </div>

                      {/* Reasoning */}
                      {p.reasoning && (
                        <div className="flex items-start gap-2 bg-muted/50 rounded p-3">
                          <Brain className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <p className="text-xs text-muted-foreground">{p.reasoning}</p>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApproveAll}
              disabled={fixMutation.isPending || proposals.every(p => !!p.error)}
            >
              {fixMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Apply {proposals.filter(p => !p.error && p.before_paragraph).length} Fix{proposals.filter(p => !p.error).length !== 1 ? "es" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
