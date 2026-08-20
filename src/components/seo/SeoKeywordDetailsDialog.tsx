import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

const TABS = [
  { id: "traffic", label: "Est. traffic" },
  { id: "traffic_value", label: "Traffic value" },
  { id: "avg_position", label: "Average position" },
  { id: "share_of_voice", label: "Share of Voice" },
  { id: "position_changes", label: "Position changes" },
  { id: "position_distribution", label: "Position distribution" },
  { id: "serp_features", label: "SERP features" },
  { id: "pages", label: "Pages" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface SeoKeywordDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: any;
}

const chartChrome = {
  stroke: "hsl(var(--border))",
  fill: "hsl(var(--muted-foreground))",
  tooltipStyle: {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    color: "hsl(var(--popover-foreground))",
  },
};

const toArray = (value: any) => (Array.isArray(value) ? value : []);

const normalizeDate = (value?: string) => {
  if (!value) return "";
  return value.slice(0, 10);
};

const formatAxisDate = (value?: string) => {
  if (!value) return "";
  return format(new Date(value), "d MMM");
};

const currentValue = (metric: any) => Number(metric?.value ?? 0);
const currentChange = (metric: any) => Number(metric?.change ?? 0);

const formatCompactNumber = (value: number) => {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
};

const formatPercent = (value: number) => `${value.toFixed(2)}%`;
const formatCurrency = (value: number) => `$${formatCompactNumber(value)}`;
const formatPosition = (value: number) => value > 0 ? value.toFixed(1) : "—";

const tooltipValueFormatter = (tab: TabId, value: number) => {
  if (tab === "traffic_value") return formatCurrency(value);
  if (tab === "share_of_voice") return formatPercent(value);
  if (tab === "avg_position") return formatPosition(value);
  return formatCompactNumber(value);
};

function mergeSeries(entries: Array<{ label: string; history: any[] }>) {
  const rows = new Map<string, Record<string, number | string>>();

  entries.forEach(({ label, history }) => {
    toArray(history).forEach((point) => {
      const date = normalizeDate(point?.datetime);
      if (!date) return;
      const row = rows.get(date) ?? { date };
      row[label] = Number(point?.value ?? 0);
      rows.set(date, row);
    });
  });

  return Array.from(rows.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function buildDistributionSeries(distribution: any[]) {
  const rows = new Map<string, Record<string, number | string>>();

  distribution.forEach((bucket) => {
    const label = bucket?.range_start === 1 && bucket?.range_end === 1
      ? "Pos. 1"
      : bucket?.range_start === 2 && bucket?.range_end === 3
        ? "Pos. 2-3"
        : bucket?.range_start === 4 && bucket?.range_end === 10
          ? "Pos. 4-10"
          : bucket?.range_start === 11 && bucket?.range_end === 30
            ? "Pos. 11-30"
            : "Pos. >30";

    toArray(bucket?.history).forEach((point: any) => {
      const date = normalizeDate(point?.datetime);
      if (!date) return;
      const row = rows.get(date) ?? { date };
      row[label] = Number(point?.value ?? 0);
      rows.set(date, row);
    });
  });

  return Array.from(rows.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function buildEntityRows(domain: any) {
  const ownSite = domain?.wincher_data_json;
  const ownRanking = ownSite?.ranking || {};
  const competitors = toArray(domain?.wincher_competitors_json?.summaries?.data);

  const ownKeywordCount = Number(ownSite?.keyword_count ?? toArray(ownRanking?.position_distribution).reduce((sum: number, bucket: any) => sum + Number(bucket?.value ?? 0), 0));
  const ownPositionDelta = currentValue(ownRanking?.positions_gained) - currentValue(ownRanking?.positions_lost);

  const rows = [
    {
      website: ownSite?.domain || domain?.domain,
      shareOfVoice: currentValue(ownRanking?.share_of_voice),
      shareOfVoiceChange: currentChange(ownRanking?.share_of_voice),
      traffic: currentValue(ownRanking?.traffic),
      trafficChange: currentChange(ownRanking?.traffic),
      avgPosition: currentValue(ownRanking?.avg_position),
      avgPositionChange: currentChange(ownRanking?.avg_position),
      positionChange: ownPositionDelta,
      keywordCount: ownKeywordCount,
      ranking: ownRanking,
      isOwn: true,
    },
    ...competitors.map((entry: any) => {
      const ranking = entry?.ranking || {};
      const keywordCount = toArray(ranking?.position_distribution).reduce((sum: number, bucket: any) => sum + Number(bucket?.value ?? 0), 0);
      return {
        website: entry?.domain,
        shareOfVoice: currentValue(ranking?.share_of_voice),
        shareOfVoiceChange: currentChange(ranking?.share_of_voice),
        traffic: currentValue(ranking?.traffic),
        trafficChange: currentChange(ranking?.traffic),
        avgPosition: currentValue(ranking?.avg_position),
        avgPositionChange: currentChange(ranking?.avg_position),
        positionChange: currentValue(ranking?.positions_gained) - currentValue(ranking?.positions_lost),
        keywordCount,
        ranking,
        isOwn: false,
      };
    }),
  ];

  return rows.sort((a, b) => b.shareOfVoice - a.shareOfVoice);
}

export function SeoKeywordDetailsDialog({ open, onOpenChange, domain }: SeoKeywordDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>("traffic");
  const [showAll, setShowAll] = useState(true);

  const tableRows = useMemo(() => buildEntityRows(domain), [domain]);
  const ownSite = domain?.wincher_data_json;
  const ownRanking = ownSite?.ranking || {};

  const comparisonRows = useMemo(() => {
    if (showAll) return tableRows.slice(0, 6);
    return tableRows.filter((row) => row.isOwn).slice(0, 1);
  }, [showAll, tableRows]);

  const metricSeries = useMemo(() => {
    const metricKey = activeTab === "pages" ? "ranking_pages" : activeTab;

    return mergeSeries(
      comparisonRows.map((row) => ({
        label: row.website,
        history: toArray(row.ranking?.[metricKey]?.history),
      })),
    );
  }, [activeTab, comparisonRows]);

  const positionChangesSeries = useMemo(() => {
    const gained = toArray(ownRanking?.positions_gained?.history);
    const lost = toArray(ownRanking?.positions_lost?.history);
    const rows = new Map<string, Record<string, number | string>>();

    gained.forEach((point: any) => {
      const date = normalizeDate(point?.datetime);
      if (!date) return;
      const row = rows.get(date) ?? { date };
      row.gained = Number(point?.value ?? 0);
      rows.set(date, row);
    });

    lost.forEach((point: any) => {
      const date = normalizeDate(point?.datetime);
      if (!date) return;
      const row = rows.get(date) ?? { date };
      row.lost = -Math.abs(Number(point?.value ?? 0));
      rows.set(date, row);
    });

    return Array.from(rows.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [ownRanking]);

  const positionDistributionSeries = useMemo(
    () => buildDistributionSeries(toArray(ownRanking?.position_distribution)),
    [ownRanking],
  );

  const serpFeaturesData = useMemo(
    () => toArray(ownRanking?.serp_features).map((feature: any, index: number) => ({
      name: feature?.type || `Feature ${index + 1}`,
      value: Number(feature?.value ?? 0),
    })).filter((feature: any) => feature.value > 0),
    [ownRanking],
  );

  const hasWincherData = Boolean(domain?.wincher_data_json?.ranking);

  const renderMetricChart = () => {
    if (!metricSeries.length) {
      return <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">No chart data available yet.</div>;
    }

    const yAxisFormatter = (value: number) => {
      if (activeTab === "traffic_value") return formatCurrency(value);
      if (activeTab === "share_of_voice") return formatPercent(value);
      if (activeTab === "avg_position") return formatPosition(value);
      return formatCompactNumber(value);
    };

    const isArea = activeTab === "traffic" || activeTab === "traffic_value";

    return (
      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          {isArea ? (
            <AreaChart data={metricSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartChrome.stroke} />
              <XAxis dataKey="date" tick={{ fill: chartChrome.fill, fontSize: 12 }} tickFormatter={formatAxisDate} />
              <YAxis tick={{ fill: chartChrome.fill, fontSize: 12 }} tickFormatter={yAxisFormatter} />
              <Tooltip
                contentStyle={chartChrome.tooltipStyle}
                labelFormatter={(value) => format(new Date(String(value)), "d MMM yyyy")}
                formatter={(value: number) => tooltipValueFormatter(activeTab, Number(value))}
              />
              <Legend />
              {comparisonRows.map((row, index) => (
                <Area
                  key={row.website}
                  type="monotone"
                  dataKey={row.website}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  fillOpacity={0.18}
                  strokeWidth={2.5}
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart data={metricSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartChrome.stroke} />
              <XAxis dataKey="date" tick={{ fill: chartChrome.fill, fontSize: 12 }} tickFormatter={formatAxisDate} />
              <YAxis tick={{ fill: chartChrome.fill, fontSize: 12 }} tickFormatter={yAxisFormatter} reversed={activeTab === "avg_position"} />
              <Tooltip
                contentStyle={chartChrome.tooltipStyle}
                labelFormatter={(value) => format(new Date(String(value)), "d MMM yyyy")}
                formatter={(value: number) => tooltipValueFormatter(activeTab, Number(value))}
              />
              <Legend />
              {comparisonRows.map((row, index) => (
                <Line
                  key={row.website}
                  type="monotone"
                  dataKey={row.website}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  const renderActiveTab = () => {
    if (activeTab === "position_changes") {
      return (
        <div className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={positionChangesSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartChrome.stroke} />
              <XAxis dataKey="date" tick={{ fill: chartChrome.fill, fontSize: 12 }} tickFormatter={formatAxisDate} />
              <YAxis tick={{ fill: chartChrome.fill, fontSize: 12 }} />
              <Tooltip contentStyle={chartChrome.tooltipStyle} labelFormatter={(value) => format(new Date(String(value)), "d MMM yyyy")} />
              <Legend />
              <Bar dataKey="gained" name="Gained positions" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} />
              <Bar dataKey="lost" name="Lost positions" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (activeTab === "position_distribution") {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-5">
            {[
              { label: "Pos. 1", key: "Pos. 1", color: "bg-success/10 text-success" },
              { label: "Pos. 2-3", key: "Pos. 2-3", color: "bg-primary/10 text-primary" },
              { label: "Pos. 4-10", key: "Pos. 4-10", color: "bg-accent/10 text-accent-foreground" },
              { label: "Pos. 11-30", key: "Pos. 11-30", color: "bg-warning/10 text-warning" },
              { label: "Pos. >30", key: "Pos. >30", color: "bg-destructive/10 text-destructive" },
            ].map((item) => (
              <div key={item.key} className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={`mt-1 inline-flex rounded-full px-2 py-1 text-sm font-semibold ${item.color}`}>
                  {formatCompactNumber(Number(positionDistributionSeries.at(-1)?.[item.key] ?? 0))}
                </p>
              </div>
            ))}
          </div>
          <div className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={positionDistributionSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartChrome.stroke} />
                <XAxis dataKey="date" tick={{ fill: chartChrome.fill, fontSize: 12 }} tickFormatter={formatAxisDate} />
                <YAxis tick={{ fill: chartChrome.fill, fontSize: 12 }} />
                <Tooltip contentStyle={chartChrome.tooltipStyle} labelFormatter={(value) => format(new Date(String(value)), "d MMM yyyy")} />
                <Legend />
                <Bar dataKey="Pos. 1" stackId="positions" fill="hsl(var(--success))" />
                <Bar dataKey="Pos. 2-3" stackId="positions" fill="hsl(var(--primary))" />
                <Bar dataKey="Pos. 4-10" stackId="positions" fill="hsl(var(--accent))" />
                <Bar dataKey="Pos. 11-30" stackId="positions" fill="hsl(var(--warning))" />
                <Bar dataKey="Pos. >30" stackId="positions" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (activeTab === "serp_features") {
      return (
        <div className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serpFeaturesData} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartChrome.stroke} />
              <XAxis type="number" tick={{ fill: chartChrome.fill, fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: chartChrome.fill, fontSize: 12 }} width={140} />
              <Tooltip contentStyle={chartChrome.tooltipStyle} formatter={(value: number) => formatCompactNumber(Number(value))} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return renderMetricChart();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[96vw] overflow-hidden border-border bg-background p-0 sm:max-w-7xl">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <DialogTitle className="text-2xl">Wincher performance dashboard</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasWincherData ? `Live view for ${ownSite?.domain || domain?.domain}` : "Run Wincher sync to populate dashboard data."}
              </p>
            </div>
            {hasWincherData && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Tracked keywords {formatCompactNumber(Number(ownSite?.keyword_count ?? 0))}</Badge>
                <Badge variant="secondary">Competitors {formatCompactNumber(Number(domain?.wincher_data_json?.competitor_count ?? tableRows.length - 1))}</Badge>
                <Badge variant="secondary">Synced {domain?.wincher_synced_at ? format(new Date(domain.wincher_synced_at), "d MMM yyyy HH:mm") : "—"}</Badge>
              </div>
            )}
          </div>
        </DialogHeader>

        {!hasWincherData ? (
          <div className="flex h-[420px] items-center justify-center px-6 text-sm text-muted-foreground">
            No Wincher dashboard data yet.
          </div>
        ) : (
          <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-6 py-5">
            <div className="rounded-2xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                      <th className="px-4 py-3 text-left font-medium">Website</th>
                      <th className="px-4 py-3 text-right font-medium">Share of Voice</th>
                      <th className="px-4 py-3 text-right font-medium">Est. traffic</th>
                      <th className="px-4 py-3 text-right font-medium">Avg. pos.</th>
                      <th className="px-4 py-3 text-right font-medium">Pos. chg.</th>
                      <th className="px-4 py-3 text-right font-medium">Keyw.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, index) => (
                      <tr key={`${row.website}-${index}`} className="border-b border-border/70 last:border-0">
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${row.isOwn ? "bg-primary" : "bg-muted-foreground"}`} />
                            <span>{row.website}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span>{formatPercent(row.shareOfVoice)}</span>
                          <span className={`ml-2 text-xs ${row.shareOfVoiceChange >= 0 ? "text-success" : "text-destructive"}`}>
                            {row.shareOfVoiceChange >= 0 ? "+" : ""}{row.shareOfVoiceChange.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span>{formatCompactNumber(row.traffic)}</span>
                          <span className={`ml-2 text-xs ${row.trafficChange >= 0 ? "text-success" : "text-destructive"}`}>
                            {row.trafficChange >= 0 ? "+" : ""}{formatCompactNumber(row.trafficChange)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span>{formatPosition(row.avgPosition)}</span>
                          <span className={`ml-2 text-xs ${row.avgPositionChange <= 0 ? "text-success" : "text-destructive"}`}>
                            {row.avgPositionChange > 0 ? "+" : ""}{row.avgPositionChange.toFixed(1)}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${row.positionChange >= 0 ? "text-success" : "text-destructive"}`}>
                          {row.positionChange >= 0 ? "+" : ""}{formatCompactNumber(row.positionChange)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{formatCompactNumber(row.keywordCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {TABS.map((tab) => (
                  <Button
                    key={tab.id}
                    type="button"
                    variant={activeTab === tab.id ? "default" : "ghost"}
                    className="rounded-full"
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>

              <label className="flex items-center gap-3 rounded-full border border-border px-4 py-2 text-sm">
                <span>Show all competitors</span>
                <Switch checked={showAll} onCheckedChange={setShowAll} />
              </label>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-card p-4">
              {renderActiveTab()}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
