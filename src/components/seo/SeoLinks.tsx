import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, ExternalLink, AlertTriangle, CheckCircle, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type StatusFilter = "all" | "broken" | "opportunity" | "fixed";

const statusBadge: Record<string, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-green-500/10 text-green-600" },
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
  const qc = useQueryClient();

  // Get domain
  const { data: domain } = useQuery({
    queryKey: ["seo-domain"],
    queryFn: async () => {
      const { data } = await supabase.from("seo_domains").select("*").limit(1).single();
      return data;
    },
  });

  // Fetch audit results
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

  // Run crawl
  const crawlMutation = useMutation({
    mutationFn: async () => {
      if (!domain) throw new Error("No domain configured");
      const { data, error } = await supabase.functions.invoke("seo-link-audit", {
        body: { phase: "crawl", domain_id: domain.id, company_id: domain.company_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Audit complete: ${data.stats?.total || 0} links found, ${data.stats?.broken || 0} broken, ${data.stats?.opportunities || 0} opportunities`);
      qc.invalidateQueries({ queryKey: ["seo-link-audits"] });
    },
    onError: (e) => toast.error(`Crawl failed: ${e.message}`),
  });

  // Fix single
  const fixMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!domain) throw new Error("No domain");
      const { data, error } = await supabase.functions.invoke("seo-link-audit", {
        body: { phase: "fix", audit_ids: ids, company_id: domain.company_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Done — ${data.fixed || 0} fixes applied`);
      qc.invalidateQueries({ queryKey: ["seo-link-audits"] });
    },
    onError: (e) => toast.error(`Fix failed: ${e.message}`),
  });

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
      <div className="flex items-center justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="broken">Broken ({stats.broken})</TabsTrigger>
            <TabsTrigger value="opportunity">Opportunities ({stats.opportunities})</TabsTrigger>
            <TabsTrigger value="fixed">Fixed ({stats.fixed})</TabsTrigger>
          </TabsList>
        </Tabs>
        {unfixedOpportunities.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fixMutation.mutate(unfixedOpportunities)}
            disabled={fixMutation.isPending}
          >
            {fixMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Fix All Opportunities ({unfixedOpportunities.length})
          </Button>
        )}
      </div>

      {/* Results table */}
      {isLoading ? (
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
                          onClick={() => fixMutation.mutate([a.id])}
                          disabled={fixMutation.isPending}
                        >
                          Fix
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
