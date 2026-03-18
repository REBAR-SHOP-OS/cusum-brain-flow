import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GripVertical, Loader2, Minus, Search, Settings2, Sparkles, TrendingDown, TrendingUp, LayoutDashboard } from "lucide-react";
import { useSemrushSync } from "@/hooks/useSemrushApi";
import { SeoKeywordDetailsDialog } from "@/components/seo/SeoKeywordDetailsDialog";

const statusColors: Record<string, string> = {
  winner: "bg-success/10 text-success",
  opportunity: "bg-primary/10 text-primary",
  stagnant: "bg-warning/10 text-warning",
  declining: "bg-destructive/10 text-destructive",
};

const intentColors: Record<string, string> = {
  informational: "bg-secondary text-secondary-foreground",
  commercial: "bg-primary/10 text-primary",
  transactional: "bg-success/10 text-success",
  navigational: "bg-warning/10 text-warning",
};

const sourceColors: Record<string, string> = {
  gsc: "bg-primary/10 text-primary",
  social: "bg-accent/10 text-accent-foreground",
  email: "bg-warning/10 text-warning",
  leads: "bg-success/10 text-success",
  quotes: "bg-secondary text-secondary-foreground",
  orders: "bg-primary/10 text-primary",
  knowledge: "bg-muted text-muted-foreground",
  wordpress: "bg-accent/10 text-accent-foreground",
  prospects: "bg-destructive/10 text-destructive",
  wincher: "bg-success/10 text-success",
};

const allSources = ["gsc", "social", "email", "leads", "quotes", "orders", "knowledge", "wordpress", "prospects", "wincher"];

const columnDefs = [
  { id: "keyword", label: "Keyword", alwaysVisible: true },
  { id: "intent", label: "Search intent" },
  { id: "position", label: "Position" },
  { id: "wincher_position", label: "Wincher position" },
  { id: "all_time_high", label: "All-time high position" },
  { id: "estimated_traffic", label: "Estimated traffic" },
  { id: "volume", label: "Volume" },
  { id: "difficulty", label: "Keyword difficulty" },
  { id: "cpc", label: "CPC" },
  { id: "serp", label: "SERP" },
  { id: "top_page", label: "Top ranking page" },
  { id: "updated", label: "Updated" },
  { id: "added", label: "Added" },
  { id: "status", label: "Status" },
  { id: "sources", label: "Sources" },
  { id: "opportunity", label: "Opportunity" },
] as const;

type ColumnId = (typeof columnDefs)[number]["id"];

const defaultColumnOrder: ColumnId[] = [
  "keyword",
  "intent",
  "position",
  "wincher_position",
  "estimated_traffic",
  "volume",
  "difficulty",
  "cpc",
  "serp",
  "top_page",
  "updated",
  "added",
  "status",
  "sources",
  "opportunity",
  "all_time_high",
];

const defaultVisibility: Record<ColumnId, boolean> = {
  keyword: true,
  intent: true,
  position: true,
  wincher_position: true,
  estimated_traffic: true,
  volume: true,
  difficulty: false,
  cpc: false,
  serp: true,
  top_page: true,
  updated: true,
  added: false,
  status: true,
  sources: true,
  opportunity: true,
  all_time_high: false,
};

const formatCompactNumber = (value?: number | null) => {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value));
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
};

function loadLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function Sparkline({ history }: { history: any[] }) {
  const points = useMemo(() => {
    const series = Array.isArray(history) ? history : [];
    if (!series.length) return "";
    const values = series.map((point) => Number(point?.value ?? 0)).filter((value) => Number.isFinite(value));
    if (!values.length) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return values
      .map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * 100;
        const y = 20 - ((value - min) / range) * 20;
        return `${x},${y}`;
      })
      .join(" ");
  }, [history]);

  if (!points) return null;

  return (
    <svg viewBox="0 0 100 20" className="mt-1 h-5 w-20 overflow-visible">
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function SeoKeywords() {
  const [search, setSearch] = useState("");
  const [filterIntent, setFilterIntent] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [sortBy, setSortBy] = useState("opportunity");
  const [researchInput, setResearchInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<ColumnId | null>(null);
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(() => loadLocalStorage("seo-keyword-column-order", defaultColumnOrder));
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnId, boolean>>(() => loadLocalStorage("seo-keyword-column-visibility", defaultVisibility));
  const [showGroupTags, setShowGroupTags] = useState(() => loadLocalStorage("seo-keyword-show-group-tags", true));
  const [showMiniTrends, setShowMiniTrends] = useState(() => loadLocalStorage("seo-keyword-show-mini-trends", true));
  const { researchKeyword } = useSemrushSync();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("seo-keyword-column-order", JSON.stringify(columnOrder));
  }, [columnOrder]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("seo-keyword-column-visibility", JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("seo-keyword-show-group-tags", JSON.stringify(showGroupTags));
  }, [showGroupTags]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("seo-keyword-show-mini-trends", JSON.stringify(showMiniTrends));
  }, [showMiniTrends]);

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
        .order("opportunity_score", { ascending: false })
        .range(0, 9999);
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
      if (sortBy === "traffic") return (b.wincher_traffic || 0) - (a.wincher_traffic || 0);
      if (sortBy === "volume") return (b.volume || 0) - (a.volume || 0);
      if (sortBy === "position") return (a.wincher_position || 999) - (b.wincher_position || 999);
      if (sortBy === "business") return (b.business_relevance || 0) - (a.business_relevance || 0);
      if (sortBy === "sources") return (b.source_count || 0) - (a.source_count || 0);
      return (b.opportunity_score || 0) - (a.opportunity_score || 0);
    });

  const visibleColumns = columnOrder.filter((columnId) => columnVisibility[columnId]);

  const trendIcon = (score: number | null) => {
    if (!score) return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (score > 10) return <TrendingUp className="h-3 w-3 text-success" />;
    if (score < -10) return <TrendingDown className="h-3 w-3 text-destructive" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const reorderColumns = (sourceId: ColumnId, targetId: ColumnId) => {
    if (sourceId === targetId) return;
    setColumnOrder((current) => {
      const next = [...current];
      const sourceIndex = next.indexOf(sourceId);
      const targetIndex = next.indexOf(targetId);
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceId);
      return next;
    });
  };

  const moveColumn = (columnId: ColumnId, direction: -1 | 1) => {
    setColumnOrder((current) => {
      const index = current.indexOf(columnId);
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const renderCell = (kw: any, columnId: ColumnId) => {
    switch (columnId) {
      case "keyword":
        return (
          <div>
            <div className="font-medium">
              {kw.sample_context ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help border-b border-dotted border-muted-foreground">{kw.keyword}</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    <p className="mb-1 font-medium">Source Context</p>
                    <p>{kw.sample_context}</p>
                  </TooltipContent>
                </Tooltip>
              ) : kw.keyword}
            </div>
            {showMiniTrends && Array.isArray(kw.wincher_position_history_json?.data || kw.wincher_position_history_json?.history || kw.wincher_position_history_json) && (
              <Sparkline history={kw.wincher_position_history_json?.data || kw.wincher_position_history_json?.history || kw.wincher_position_history_json} />
            )}
          </div>
        );
      case "intent":
        return showGroupTags
          ? <Badge className={`text-[10px] ${intentColors[kw.intent] || "bg-muted text-muted-foreground"}`}>{kw.intent || "—"}</Badge>
          : <span>{kw.intent || "—"}</span>;
      case "position":
        return <span className="font-mono">{kw.avg_position ? Number(kw.avg_position).toFixed(1) : "—"}</span>;
      case "wincher_position":
        return (
          <div className="flex items-center justify-end gap-2 font-mono">
            <span>{kw.wincher_position ?? "—"}</span>
            <span className="text-xs">{trendIcon(kw.trend_score)}</span>
          </div>
        );
      case "all_time_high":
        return <span className="font-mono">{kw.wincher_best_position ?? "—"}</span>;
      case "estimated_traffic":
        return <span className="font-mono">{formatCompactNumber(kw.wincher_traffic ?? kw.clicks_28d)}</span>;
      case "volume":
        return <span className="font-mono">{kw.volume ? Number(kw.volume).toLocaleString() : "—"}</span>;
      case "difficulty":
        return <span className="font-mono">{kw.wincher_difficulty ?? "—"}</span>;
      case "cpc":
        return <span className="font-mono">{kw.wincher_cpc != null ? `$${Number(kw.wincher_cpc).toFixed(2)}` : "—"}</span>;
      case "serp":
        return <span className="font-mono">{Array.isArray(kw.wincher_serp_features_json) ? kw.wincher_serp_features_json.length : "—"}</span>;
      case "top_page": {
        const topPage = Array.isArray(kw.wincher_ranking_pages_json) ? kw.wincher_ranking_pages_json[0]?.url || kw.wincher_ranking_pages_json[0]?.page : kw.top_page;
        return <span className="block max-w-[220px] truncate">{topPage || "—"}</span>;
      }
      case "updated":
        return <span>{formatDate(kw.wincher_synced_at)}</span>;
      case "added":
        return <span>{formatDate(kw.created_at)}</span>;
      case "status":
        return showGroupTags
          ? <Badge className={`text-[10px] ${statusColors[kw.status] || "bg-muted text-muted-foreground"}`}>{kw.status || "—"}</Badge>
          : <span>{kw.status || "—"}</span>;
      case "sources":
        return (
          <div className="flex flex-wrap justify-end gap-1">
            {(kw.sources || []).map((src: string) => (
              <Badge key={src} className={`text-[9px] ${sourceColors[src] || "bg-muted text-muted-foreground"}`}>
                {src}
              </Badge>
            ))}
          </div>
        );
      case "opportunity":
        return (
          <div className="flex items-center justify-end gap-2">
            <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, kw.opportunity_score || 0)}%` }} />
            </div>
            <span className="font-mono text-xs">{Number(kw.opportunity_score || 0).toFixed(0)}</span>
          </div>
        );
      default:
        return <span>—</span>;
    }
  };

  const wincherRows = filtered.filter((kw: any) => kw.wincher_keyword_id != null).length;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Sparkles className="h-5 w-5 text-primary" /> Keyword Intelligence
            </h1>
            <p className="text-sm text-muted-foreground">Keyword opportunities ranked by impact, now with Wincher columns, settings, and performance charts.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Total {filtered.length}</Badge>
            <Badge variant="secondary">Wincher synced {wincherRows}</Badge>
            {domain?.wincher_synced_at && <Badge variant="secondary">Last sync {formatDate(domain.wincher_synced_at)}</Badge>}
          </div>
        </div>

        <Card className="border-primary/20">
          <CardContent className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3 lg:flex-1">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <Input
                placeholder="Research a keyword (SEMrush API)..."
                value={researchInput}
                onChange={(e) => setResearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && researchInput.trim()) researchKeyword.mutate({ keyword: researchInput.trim() }); }}
                className="flex-1"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => researchInput.trim() && researchKeyword.mutate({ keyword: researchInput.trim() })} disabled={researchKeyword.isPending || !researchInput.trim()}>
                {researchKeyword.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}
                Research
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="mr-1 h-4 w-4" />
                Table settings
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDashboardOpen(true)} disabled={!domain?.wincher_data_json}>
                <LayoutDashboard className="mr-1 h-4 w-4" />
                Wincher dashboard
              </Button>
            </div>
          </CardContent>
          {researchKeyword.data && (
            <CardContent className="pt-0 pb-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <span><strong>Keyword:</strong> {researchKeyword.data.keyword}</span>
                <span><strong>Volume:</strong> {researchKeyword.data.volume?.toLocaleString()}</span>
                <span><strong>Difficulty:</strong> {researchKeyword.data.difficulty}</span>
                <span><strong>CPC:</strong> ${researchKeyword.data.cpc?.toFixed(2)}</span>
                <span><strong>Competition:</strong> {researchKeyword.data.competition?.toFixed(2)}</span>
              </div>
            </CardContent>
          )}
        </Card>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search keywords..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterIntent} onValueChange={setFilterIntent}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Intent" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Intents</SelectItem>
              <SelectItem value="informational">Informational</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="transactional">Transactional</SelectItem>
              <SelectItem value="navigational">Navigational</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="winner">Winners</SelectItem>
              <SelectItem value="opportunity">Opportunities</SelectItem>
              <SelectItem value="stagnant">Stagnant</SelectItem>
              <SelectItem value="declining">Declining</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {allSources.map((source) => (
                <SelectItem key={source} value={source}>{source}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="opportunity">Opportunity</SelectItem>
              <SelectItem value="traffic">Traffic</SelectItem>
              <SelectItem value="volume">Volume</SelectItem>
              <SelectItem value="position">Best position</SelectItem>
              <SelectItem value="business">Business relevance</SelectItem>
              <SelectItem value="sources">Source count</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {visibleColumns.map((columnId) => (
                      <th key={columnId} className={`p-3 font-medium ${columnId === "keyword" ? "text-left" : "text-right"}`}>
                        {columnDefs.find((column) => column.id === columnId)?.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="p-8 text-center text-muted-foreground">Loading...</td>
                    </tr>
                  ) : !filtered.length ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="p-8 text-center text-muted-foreground">No keywords yet. Run Wincher sync or full analysis to populate this table.</td>
                    </tr>
                  ) : (
                    filtered.map((kw: any) => (
                      <tr key={kw.id} className="border-b transition-colors hover:bg-muted/30">
                        {visibleColumns.map((columnId) => (
                          <td key={columnId} className={`p-3 align-middle ${columnId === "keyword" ? "text-left" : "text-right"}`}>
                            {renderCell(kw, columnId)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
            <DialogHeader className="border-b border-border px-6 py-4">
              <DialogTitle className="text-center text-2xl">Settings</DialogTitle>
            </DialogHeader>
            <div className="max-h-[calc(90vh-130px)] overflow-y-auto px-6 py-5">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-muted-foreground">Settings</h3>
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <p className="font-medium">Show group tags</p>
                      <p className="text-sm text-muted-foreground">Use colored badges for intent, status, and sources.</p>
                    </div>
                    <Switch checked={showGroupTags} onCheckedChange={setShowGroupTags} />
                  </div>
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <p className="font-medium">Show mini trend charts</p>
                      <p className="text-sm text-muted-foreground">Render a small Wincher sparkline below each keyword.</p>
                    </div>
                    <Switch checked={showMiniTrends} onCheckedChange={setShowMiniTrends} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-muted-foreground">Columns (drag and drop to reorder)</h3>
                  <div className="space-y-2">
                    {columnOrder.map((columnId) => {
                      const column = columnDefs.find((item) => item.id === columnId)!;
                      const isLocked = columnId === "keyword";
                      return (
                        <div
                          key={columnId}
                          draggable={!isLocked}
                          onDragStart={() => setDraggedColumn(columnId)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            if (draggedColumn) reorderColumns(draggedColumn, columnId);
                            setDraggedColumn(null);
                          }}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{column.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => moveColumn(columnId, -1)}>↑</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => moveColumn(columnId, 1)}>↓</Button>
                            <Switch
                              checked={columnVisibility[columnId]}
                              disabled={isLocked}
                              onCheckedChange={(checked) => setColumnVisibility((current) => ({ ...current, [columnId]: checked }))}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t border-border px-6 py-4">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
              <Button onClick={() => setSettingsOpen(false)}>Apply settings</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SeoKeywordDetailsDialog open={dashboardOpen} onOpenChange={setDashboardOpen} domain={domain} />
      </div>
    </TooltipProvider>
  );
}
