import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

export function SeoKeywords() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [expandedKeyword, setExpandedKeyword] = useState<string | null>(null);
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterDevice, setFilterDevice] = useState<string>("all");

  // Get first domain (auto-select)
  const { data: domain } = useQuery({
    queryKey: ["seo-domain"],
    queryFn: async () => {
      const { data } = await supabase.from("seo_domains").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  // Keywords
  const { data: keywords, isLoading } = useQuery({
    queryKey: ["seo-keywords", domain?.id, filterCountry, filterDevice],
    enabled: !!domain?.id,
    queryFn: async () => {
      let q = supabase
        .from("seo_keywords")
        .select("*")
        .eq("domain_id", domain!.id)
        .eq("active", true)
        .order("keyword");
      if (filterCountry !== "all") q = q.eq("country", filterCountry);
      if (filterDevice !== "all") q = q.eq("device", filterDevice);
      const { data } = await q;
      return data || [];
    },
  });

  // Latest ranks for each keyword
  const { data: latestRanks } = useQuery({
    queryKey: ["seo-latest-ranks", keywords?.map((k: any) => k.id)],
    enabled: !!keywords?.length,
    queryFn: async () => {
      const ids = keywords!.map((k: any) => k.id);
      const { data } = await supabase
        .from("seo_rank_history")
        .select("*")
        .in("keyword_id", ids)
        .order("date", { ascending: false })
        .limit(ids.length * 14);

      // Group: latest per keyword + 7d ago
      const map = new Map<string, { current: number | null; prev: number | null; url: string | null }>();
      const sevenAgo = new Date();
      sevenAgo.setDate(sevenAgo.getDate() - 7);
      const sevenAgoStr = sevenAgo.toISOString().split("T")[0];

      for (const row of data || []) {
        if (!map.has(row.keyword_id)) {
          map.set(row.keyword_id, { current: Number(row.position), prev: null, url: row.url_found });
        }
        const entry = map.get(row.keyword_id)!;
        if (row.date <= sevenAgoStr && !entry.prev) {
          entry.prev = Number(row.position);
        }
      }
      return map;
    },
  });

  // Rank history for expanded keyword
  const { data: rankHistory } = useQuery({
    queryKey: ["seo-rank-history", expandedKeyword],
    enabled: !!expandedKeyword,
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_rank_history")
        .select("date, position, impressions, clicks")
        .eq("keyword_id", expandedKeyword!)
        .order("date", { ascending: true })
        .limit(90);
      return (data || []).map((r: any) => ({
        date: r.date,
        position: r.position ? Number(r.position) : null,
        impressions: r.impressions,
        clicks: r.clicks,
      }));
    },
  });

  // Add keyword mutation
  const addKeyword = useMutation({
    mutationFn: async (vals: { keyword: string; target_url: string; country: string; device: string; intent: string }) => {
      if (!domain?.id) throw new Error("No domain configured");
      const { error } = await supabase.from("seo_keywords").insert({
        domain_id: domain.id,
        keyword: vals.keyword,
        target_url: vals.target_url || null,
        country: vals.country,
        device: vals.device,
        intent: vals.intent,
        company_id: domain.company_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seo-keywords"] });
      setAddOpen(false);
      toast.success("Keyword added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [form, setForm] = useState({ keyword: "", target_url: "", country: "AU", device: "desktop", intent: "informational" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Keywords</h1>
          <p className="text-sm text-muted-foreground">Track keyword rankings across search engines</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Keyword</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Keyword</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Keyword</Label><Input value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} placeholder="rebar supplier melbourne" /></div>
              <div><Label>Target URL (optional)</Label><Input value={form.target_url} onChange={(e) => setForm({ ...form, target_url: e.target.value })} placeholder="https://rebar.shop/..." /></div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Country</Label>
                  <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AU">Australia</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="GB">United Kingdom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Device</Label>
                  <Select value={form.device} onValueChange={(v) => setForm({ ...form, device: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desktop">Desktop</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Intent</Label>
                  <Select value={form.intent} onValueChange={(v) => setForm({ ...form, intent: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="informational">Informational</SelectItem>
                      <SelectItem value="transactional">Transactional</SelectItem>
                      <SelectItem value="navigational">Navigational</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full" onClick={() => addKeyword.mutate(form)} disabled={!form.keyword || addKeyword.isPending}>
                {addKeyword.isPending ? "Adding..." : "Add Keyword"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={filterCountry} onValueChange={setFilterCountry}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            <SelectItem value="AU">Australia</SelectItem>
            <SelectItem value="US">United States</SelectItem>
            <SelectItem value="GB">UK</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDevice} onValueChange={setFilterDevice}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Device" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Devices</SelectItem>
            <SelectItem value="desktop">Desktop</SelectItem>
            <SelectItem value="mobile">Mobile</SelectItem>
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
                  <th className="text-center p-3 font-medium w-20">Change</th>
                  <th className="text-left p-3 font-medium">Ranking URL</th>
                  <th className="text-center p-3 font-medium w-16">Country</th>
                  <th className="text-center p-3 font-medium w-16">Device</th>
                  <th className="text-center p-3 font-medium w-24">Intent</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : !keywords?.length ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No keywords tracked yet. Add keywords or sync from GSC.</td></tr>
                ) : (
                  keywords.map((kw: any) => {
                    const rank = latestRanks?.get(kw.id);
                    const current = rank?.current;
                    const delta = rank?.prev && current ? rank.prev - current : null;
                    const isExpanded = expandedKeyword === kw.id;
                    const alertDrop = delta !== null && delta < -5;

                    return (
                      <>
                        <tr
                          key={kw.id}
                          className={`border-b cursor-pointer hover:bg-muted/30 transition-colors ${alertDrop ? "bg-destructive/5" : ""}`}
                          onClick={() => setExpandedKeyword(isExpanded ? null : kw.id)}
                        >
                          <td className="p-3 font-medium">{kw.keyword}</td>
                          <td className="p-3 text-center font-mono">{current ?? "—"}</td>
                          <td className="p-3 text-center">
                            {delta !== null ? (
                              <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                                {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                {Math.abs(delta)}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground truncate max-w-[200px]">{rank?.url || "—"}</td>
                          <td className="p-3 text-center"><Badge variant="outline" className="text-[10px]">{kw.country}</Badge></td>
                          <td className="p-3 text-center"><Badge variant="outline" className="text-[10px]">{kw.device}</Badge></td>
                          <td className="p-3 text-center"><Badge variant="secondary" className="text-[10px]">{kw.intent}</Badge></td>
                        </tr>
                        {isExpanded && rankHistory && (
                          <tr key={`${kw.id}-chart`}>
                            <td colSpan={7} className="p-4 bg-muted/20">
                              <p className="text-xs font-medium mb-2">Rank History (last 90 days)</p>
                              <ResponsiveContainer width="100%" height={150}>
                                <LineChart data={rankHistory}>
                                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                  <YAxis reversed domain={[1, "auto"]} tick={{ fontSize: 10 }} />
                                  <Tooltip />
                                  <Line type="monotone" dataKey="position" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </td>
                          </tr>
                        )}
                      </>
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
