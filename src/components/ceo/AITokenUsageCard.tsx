import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Brain, Zap, TrendingUp, DollarSign } from "lucide-react";

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-pro":              { input: 1.25,  output: 10.00 },
  "google/gemini-3.1-pro-preview":      { input: 1.25,  output: 10.00 },
  "google/gemini-3-flash-preview":      { input: 0.10,  output: 0.40  },
  "google/gemini-2.5-flash":            { input: 0.15,  output: 0.60  },
  "google/gemini-2.5-flash-lite":       { input: 0.02,  output: 0.10  },
  "google/gemini-3-pro-image-preview":  { input: 1.25,  output: 10.00 },
  "google/gemini-3.1-flash-image-preview": { input: 0.10, output: 0.40 },
  "openai/gpt-5":                       { input: 10.00, output: 30.00 },
  "openai/gpt-5-mini":                  { input: 1.10,  output: 4.40  },
  "openai/gpt-5-nano":                  { input: 0.10,  output: 0.40  },
  "openai/gpt-5.2":                     { input: 12.00, output: 40.00 },
  "openai/gpt-4o":                      { input: 2.50,  output: 10.00 },
};
const DEFAULT_PRICING = { input: 1.00, output: 4.00 };

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const p = MODEL_PRICING[model] || DEFAULT_PRICING;
  return (promptTokens * p.input + completionTokens * p.output) / 1_000_000;
}

function formatUSD(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

type Period = "30" | "60" | "90";

interface UsageSummaryRow {
  provider: string;
  model: string;
  agent_name: string;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_total_tokens: number;
  call_count: number;
}

interface DailyRow {
  day: string;
  provider: string;
  total_tokens: number;
  call_count: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210 80% 55%)",
  "hsl(150 60% 45%)",
  "hsl(30 90% 55%)",
  "hsl(280 60% 55%)",
  "hsl(0 70% 55%)",
  "hsl(190 70% 45%)",
];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function AITokenUsageCard() {
  const [period, setPeriod] = useState<Period>("30");

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["ai-usage-summary", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ai_usage_summary", { days_back: Number(period) });
      if (error) throw error;
      return (data || []) as UsageSummaryRow[];
    },
  });

  const { data: daily } = useQuery({
    queryKey: ["ai-usage-daily", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ai_usage_daily", { days_back: Number(period) });
      if (error) throw error;
      return (data || []) as DailyRow[];
    },
  });

  // Aggregations
  const totalTokens = summary?.reduce((s, r) => s + r.total_total_tokens, 0) ?? 0;
  const totalCalls = summary?.reduce((s, r) => s + r.call_count, 0) ?? 0;
  const totalPrompt = summary?.reduce((s, r) => s + r.total_prompt_tokens, 0) ?? 0;
  const totalCompletion = summary?.reduce((s, r) => s + r.total_completion_tokens, 0) ?? 0;

  // By provider
  const byProvider = Object.values(
    (summary || []).reduce<Record<string, { name: string; tokens: number; calls: number }>>((acc, r) => {
      const key = r.provider;
      if (!acc[key]) acc[key] = { name: key, tokens: 0, calls: 0 };
      acc[key].tokens += r.total_total_tokens;
      acc[key].calls += r.call_count;
      return acc;
    }, {})
  );

  // By model with cost
  const byModel = Object.values(
    (summary || []).reduce<Record<string, { name: string; tokens: number; calls: number; cost: number }>>((acc, r) => {
      if (!acc[r.model]) acc[r.model] = { name: r.model, tokens: 0, calls: 0, cost: 0 };
      acc[r.model].tokens += r.total_total_tokens;
      acc[r.model].calls += r.call_count;
      acc[r.model].cost += estimateCost(r.model, r.total_prompt_tokens, r.total_completion_tokens);
      return acc;
    }, {})
  ).sort((a, b) => b.cost - a.cost);

  const totalCost = byModel.reduce((s, m) => s + m.cost, 0);

  // By agent
  const byAgent = Object.values(
    (summary || []).reduce<Record<string, { name: string; tokens: number; calls: number }>>((acc, r) => {
      const key = r.agent_name || "unknown";
      if (!acc[key]) acc[key] = { name: key, tokens: 0, calls: 0 };
      acc[key].tokens += r.total_total_tokens;
      acc[key].calls += r.call_count;
      return acc;
    }, {})
  ).sort((a, b) => b.tokens - a.tokens);

  // Daily trend (merged)
  const dailyTrend = Object.values(
    (daily || []).reduce<Record<string, { day: string; gemini: number; gpt: number }>>((acc, r) => {
      if (!acc[r.day]) acc[r.day] = { day: r.day, gemini: 0, gpt: 0 };
      if (r.provider === "gemini") acc[r.day].gemini += r.total_tokens;
      else acc[r.day].gpt += r.total_tokens;
      return acc;
    }, {})
  ).sort((a, b) => a.day.localeCompare(b.day));

  const chartConfig = {
    gemini: { label: "Gemini", color: "hsl(210 80% 55%)" },
    gpt: { label: "GPT", color: "hsl(150 60% 45%)" },
    tokens: { label: "Tokens", color: "hsl(var(--primary))" },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Token Usage
          </CardTitle>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList className="h-8">
              <TabsTrigger value="30" className="text-xs px-2 h-6">30d</TabsTrigger>
              <TabsTrigger value="60" className="text-xs px-2 h-6">60d</TabsTrigger>
              <TabsTrigger value="90" className="text-xs px-2 h-6">90d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingSummary ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-5 gap-3">
              <div className="rounded-md border p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Tokens</p>
                <p className="text-lg font-bold">{formatTokens(totalTokens)}</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-xs text-muted-foreground">API Calls</p>
                <p className="text-lg font-bold">{totalCalls.toLocaleString()}</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-xs text-muted-foreground">Prompt Tokens</p>
                <p className="text-lg font-bold">{formatTokens(totalPrompt)}</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-xs text-muted-foreground">Completion</p>
                <p className="text-lg font-bold">{formatTokens(totalCompletion)}</p>
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><DollarSign className="h-3 w-3" />Est. Cost</p>
                <p className="text-lg font-bold text-primary">{formatUSD(totalCost)}</p>
              </div>
            </div>

            {/* Daily trend */}
            {dailyTrend.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Daily Usage
                </h4>
                <ChartContainer config={chartConfig} className="h-[160px] w-full">
                  <LineChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="day" tickFormatter={(v) => v.slice(5)} className="text-[10px]" />
                    <YAxis tickFormatter={formatTokens} className="text-[10px]" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="gemini" stroke="hsl(210 80% 55%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="gpt" stroke="hsl(150 60% 45%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </div>
            )}

            {/* By Provider pie */}
            {byProvider.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5" /> By Provider
                  </h4>
                  <ChartContainer config={chartConfig} className="h-[140px] w-full">
                    <PieChart>
                      <Pie data={byProvider} dataKey="tokens" nameKey="name" cx="50%" cy="50%" outerRadius={55} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {byProvider.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">By Model</h4>
                  <div className="space-y-1 max-h-[140px] overflow-y-auto text-xs">
                    {byModel.map((m) => (
                      <div key={m.name} className="flex justify-between items-center py-1 border-b border-border/30">
                        <span className="truncate mr-2 text-muted-foreground">{m.name}</span>
                        <span className="font-mono font-medium whitespace-nowrap">{formatTokens(m.tokens)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* By Agent bar chart */}
            {byAgent.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">By Agent</h4>
                <ChartContainer config={chartConfig} className="h-[160px] w-full">
                  <BarChart data={byAgent.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis type="number" tickFormatter={formatTokens} className="text-[10px]" />
                    <YAxis type="category" dataKey="name" width={80} className="text-[10px]" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="tokens" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}

            {totalTokens === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No AI usage data for this period.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
