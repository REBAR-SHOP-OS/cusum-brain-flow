import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Search, Sparkles } from "lucide-react";

const statusColors: Record<string, string> = {
  winner: "bg-green-500/10 text-green-600",
  opportunity: "bg-primary/10 text-primary",
  stagnant: "bg-yellow-500/10 text-yellow-600",
  declining: "bg-destructive/10 text-destructive",
};

const intentColors: Record<string, string> = {
  informational: "bg-blue-500/10 text-blue-600",
  commercial: "bg-purple-500/10 text-purple-600",
  transactional: "bg-green-500/10 text-green-600",
  navigational: "bg-orange-500/10 text-orange-600",
};

const SOURCE_COLORS: Record<string, string> = {
  gsc: "bg-blue-500/10 text-blue-600",
  social: "bg-pink-500/10 text-pink-600",
  email: "bg-amber-500/10 text-amber-600",
  leads: "bg-green-500/10 text-green-600",
  quotes: "bg-purple-500/10 text-purple-600",
  orders: "bg-cyan-500/10 text-cyan-600",
  knowledge: "bg-orange-500/10 text-orange-600",
  wordpress: "bg-indigo-500/10 text-indigo-600",
  prospects: "bg-rose-500/10 text-rose-600",
};

const ALL_SOURCES = ["gsc", "social", "email", "leads", "quotes", "orders", "knowledge", "wordpress", "prospects"];

export function SeoKeywords() {
  const [search, setSearch] = useState("");
  const [filterIntent, setFilterIntent] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [sortBy, setSortBy] = useState("opportunity");

  const { data: domain } = useQuery({
    queryKey: ["seo-domain"],
    queryFn: async () => {
      const { data } = await supabase.from("seo_domains").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: keywords, isLoading } = useQuery({
    queryKey: ["seo-ai-keywords", domain?.id],
    enabled: !!domain?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_keyword_ai")
        .select("*")
        .eq("domain_id", domain!.id)
        .order("opportunity_score", { ascending: false });
      return data || [];
    },
  });

  const filtered = (keywords || [])
    .filter((kw: any) => {
      if (search && !kw.keyword.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterIntent !== "all" && kw.intent !== filterIntent) return false;
      if (filterStatus !== "all" && kw.status !== filterStatus) return false;
      if (filterSource !== "all" && !(kw.sources || []).includes(filterSource)) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      if (sortBy === "sources") return (b.source_count || 0) - (a.source_count || 0);
      if (sortBy === "business") return (b.business_relevance || 0) - (a.business_relevance || 0);
      return (b.opportunity_score || 0) - (a.opportunity_score || 0);
    });

  const trendIcon = (score: number | null) => {
    if (!score) return <Minus className="w-3 h-3 text-muted-foreground" />;
    if (score > 10) return <TrendingUp className="w-3 h-3 text-green-600" />;
    if (score < -10) return <TrendingDown className="w-3 h-3 text-destructive" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
             <Sparkles className="w-5 h-5 text-primary" /> Keyword Intelligence
          </h1>
          <p className="text-sm text-muted-foreground">Keyword opportunities ranked by impact, sourced from Search Console and ERP data</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterIntent} onValueChange={setFilterIntent}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Intent" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Intents</SelectItem>
              <SelectItem value="informational">Informational</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="transactional">Transactional</SelectItem>
              <SelectItem value="navigational">Navigational</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="winner">Winners</SelectItem>
              <SelectItem value="opportunity">Opportunities</SelectItem>
              <SelectItem value="stagnant">Stagnant</SelectItem>
              <SelectItem value="declining">Declining</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {ALL_SOURCES.map(s => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="opportunity">Opportunity</SelectItem>
              <SelectItem value="business">Business Relevance</SelectItem>
              <SelectItem value="sources">Source Count</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Keywords table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Keyword</th>
                    <th className="text-center p-3 font-medium w-20">Position</th>
                    <th className="text-center p-3 font-medium w-16">Trend</th>
                    <th className="text-center p-3 font-medium w-24">Intent</th>
                    <th className="text-left p-3 font-medium w-28">Cluster</th>
                    <th className="text-center p-3 font-medium w-24">Opportunity</th>
                    <th className="text-center p-3 font-medium w-24">Relevance</th>
                    <th className="text-center p-3 font-medium w-24">Status</th>
                    <th className="text-center p-3 font-medium w-32">Sources</th>
                    <th className="text-right p-3 font-medium w-16">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                  ) : !filtered.length ? (
                    <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No keywords yet. Run a full analysis to discover keyword opportunities.</td></tr>
                  ) : (
                    filtered.map((kw: any) => (
                      <tr key={kw.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium">
                          {kw.sample_context ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dotted border-muted-foreground">{kw.keyword}</span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">
                                <p className="font-medium mb-1">Source Context:</p>
                                <p>{kw.sample_context}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : kw.keyword}
                        </td>
                        <td className="p-3 text-center font-mono">{kw.avg_position ? Number(kw.avg_position).toFixed(1) : "—"}</td>
                        <td className="p-3 text-center">{trendIcon(kw.trend_score)}</td>
                        <td className="p-3 text-center">
                          <Badge className={`text-[10px] ${intentColors[kw.intent] || ""}`}>{kw.intent}</Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground truncate max-w-[120px]">{kw.topic_cluster || "—"}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <div className="w-12 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.min(100, kw.opportunity_score || 0)}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono">{Number(kw.opportunity_score || 0).toFixed(0)}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <div className="w-12 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-green-500"
                                style={{ width: `${Math.min(100, kw.business_relevance || 0)}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono">{Number(kw.business_relevance || 0).toFixed(0)}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={`text-[10px] ${statusColors[kw.status] || ""}`}>{kw.status}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {(kw.sources || []).map((src: string) => (
                              <Badge key={src} className={`text-[9px] px-1.5 py-0 ${SOURCE_COLORS[src] || "bg-muted text-muted-foreground"}`}>
                                {src}
                              </Badge>
                            ))}
                            {!(kw.sources || []).length && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono text-xs">{kw.clicks_28d || 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
