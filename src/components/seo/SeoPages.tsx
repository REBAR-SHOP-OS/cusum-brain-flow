import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, FileText } from "lucide-react";

const cwvColors: Record<string, string> = {
  good: "bg-green-500/10 text-green-600",
  needs_improvement: "bg-yellow-500/10 text-yellow-600",
  poor: "bg-destructive/10 text-destructive",
  unknown: "bg-muted text-muted-foreground",
};

export function SeoPages() {
  const [search, setSearch] = useState("");

  const { data: domain } = useQuery({
    queryKey: ["seo-domain"],
    queryFn: async () => {
      const { data } = await supabase.from("seo_domains").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: pages, isLoading } = useQuery({
    queryKey: ["seo-ai-pages", domain?.id],
    enabled: !!domain?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_page_ai")
        .select("*")
        .eq("domain_id", domain!.id)
        .order("seo_score", { ascending: false });
      return data || [];
    },
  });

  const filtered = (pages || []).filter((p: any) => {
    if (search && !p.url.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-destructive";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
           <FileText className="w-5 h-5 text-primary" /> Page Performance
        </h1>
        <p className="text-sm text-muted-foreground">All indexed pages ranked by SEO health, with AI-generated recommendations</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search pages..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">URL</th>
                  <th className="text-center p-3 font-medium w-20">SEO Score</th>
                   <th className="text-right p-3 font-medium w-20">Impressions</th>
                   <th className="text-right p-3 font-medium w-16">Clicks</th>
                   <th className="text-right p-3 font-medium w-20">Sessions</th>
                   <th className="text-center p-3 font-medium w-20">Engagement</th>
                   <th className="text-right p-3 font-medium w-16">Conversions</th>
                  <th className="text-center p-3 font-medium w-20">CWV</th>
                  <th className="text-left p-3 font-medium">AI Recommendations</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : !filtered.length ? (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No pages yet. Run a full analysis to populate page performance data.</td></tr>
                ) : (
                  filtered.map((pg: any) => {
                    const recs = Array.isArray(pg.ai_recommendations) ? pg.ai_recommendations : [];
                    return (
                      <tr key={pg.id} className="border-b hover:bg-muted/30 transition-colors align-top">
                        <td className="p-3">
                          <a
                            href={pg.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs truncate block max-w-[250px]"
                          >
                            {new URL(pg.url).pathname}
                          </a>
                        </td>
                        <td className={`p-3 text-center font-bold ${scoreColor(Number(pg.seo_score || 0))}`}>
                          {Number(pg.seo_score || 0).toFixed(0)}
                        </td>
                        <td className="p-3 text-right font-mono text-xs">{(pg.impressions || 0).toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-xs">{pg.clicks || 0}</td>
                        <td className="p-3 text-right font-mono text-xs">{pg.sessions || 0}</td>
                        <td className="p-3 text-center font-mono text-xs">
                          {pg.engagement_rate ? (Number(pg.engagement_rate) * 100).toFixed(0) + "%" : "—"}
                        </td>
                        <td className="p-3 text-right font-mono text-xs">{pg.conversions || 0}</td>
                        <td className="p-3 text-center">
                          <Badge className={`text-[10px] ${cwvColors[pg.cwv_status] || cwvColors.unknown}`}>
                            {pg.cwv_status === "needs_improvement" ? "Needs Work" : pg.cwv_status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {recs.length > 0 ? (
                            <div className="space-y-1">
                              {recs.slice(0, 2).map((r: any, i: number) => (
                                <p key={i} className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{r.type}:</span> {r.suggestion}
                                </p>
                              ))}
                              {recs.length > 2 && (
                                <p className="text-[10px] text-muted-foreground">+{recs.length - 2} more</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
