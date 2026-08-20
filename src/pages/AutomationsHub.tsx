import { useState } from "react";
import {
  Bot, Zap, DollarSign, TrendingUp, Factory, Brain, Users, Heart,
  Play, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  ShieldCheck, BarChart3,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAutomationConfigs, type AutomationConfig, type AutomationRun } from "@/hooks/useAutomationConfigs";

const categoryMeta: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  revenue: { icon: DollarSign, label: "Revenue Recovery", color: "text-emerald-500" },
  pipeline: { icon: TrendingUp, label: "Pipeline Velocity", color: "text-blue-500" },
  production: { icon: Factory, label: "Production & Ops", color: "text-amber-500" },
  intelligence: { icon: Brain, label: "Intelligence", color: "text-purple-500" },
  hr: { icon: Users, label: "HR & Compliance", color: "text-rose-500" },
  customer: { icon: Heart, label: "Customer Experience", color: "text-pink-500" },
};

const agentColors: Record<string, string> = {
  Penny: "bg-emerald-500/15 text-emerald-600",
  Gauge: "bg-blue-500/15 text-blue-600",
  Blitz: "bg-amber-500/15 text-amber-600",
  Forge: "bg-orange-500/15 text-orange-600",
  Atlas: "bg-purple-500/15 text-purple-600",
  Vizzy: "bg-rose-500/15 text-rose-600",
  Relay: "bg-pink-500/15 text-pink-600",
};

const statusIcons: Record<string, React.ElementType> = {
  completed: CheckCircle2,
  failed: XCircle,
  running: Clock,
  partial: ShieldCheck,
};
const statusColors: Record<string, string> = {
  completed: "text-emerald-500",
  failed: "text-destructive",
  running: "text-amber-500",
  partial: "text-amber-500",
};

function AutomationCard({
  config,
  runs,
  onToggle,
  onTrigger,
}: {
  config: AutomationConfig;
  runs: AutomationRun[];
  onToggle: (key: string, enabled: boolean) => void;
  onTrigger: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const agentStyle = agentColors[config.agent_name || ""] || "bg-muted text-muted-foreground";
  const successRate = config.total_runs > 0
    ? Math.round((config.total_success / Math.max(1, config.total_success + config.total_failed)) * 100)
    : null;

  const hasTrigger = [
    "auto_approve_penny", "ar_aging_escalation", "pipeline_lead_recycler", "quote_expiry_watchdog",
  ].includes(config.automation_key);

  return (
    <Card
      className={cn(
        "transition-all cursor-pointer hover:shadow-md",
        config.enabled ? "border-primary/20" : "opacity-60"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-sm">{config.name}</h3>
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", agentStyle)}>
                {config.agent_name}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Tier {config.tier}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{config.description}</p>

            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              <span>{config.total_runs} runs</span>
              {successRate !== null && <span>{successRate}% success</span>}
              {config.last_run_at && (
                <span>Last: {new Date(config.last_run_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasTrigger && config.enabled && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={(e) => { e.stopPropagation(); onTrigger(config.automation_key); }}
              >
                <Play className="w-3.5 h-3.5" />
              </Button>
            )}
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => onToggle(config.automation_key, checked)}
              onClick={(e) => e.stopPropagation()}
            />
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {expanded && runs.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent Runs</p>
            <div className="space-y-1.5">
              {runs.slice(0, 5).map((run) => {
                const StatusIcon = statusIcons[run.status] || Clock;
                return (
                  <div key={run.id} className="flex items-center gap-2 text-xs">
                    <StatusIcon className={cn("w-3.5 h-3.5", statusColors[run.status])} />
                    <span className="text-muted-foreground">
                      {new Date(run.started_at).toLocaleString()}
                    </span>
                    <span>{run.items_succeeded}/{run.items_processed} items</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{run.trigger_type}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AutomationsHub() {
  const { configs, recentRuns, isLoading, toggleAutomation, triggerAutomation } = useAutomationConfigs();
  const [activeTab, setActiveTab] = useState("all");

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <h1 className="text-xl font-bold mb-4">⚡ Automations Hub</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const categories = [...new Set(configs.map((c) => c.category))];
  const enabledCount = configs.filter((c) => c.enabled).length;
  const totalRuns = configs.reduce((s, c) => s + c.total_runs, 0);

  const filteredConfigs = activeTab === "all" ? configs : configs.filter((c) => c.category === activeTab);

  const getRunsForAutomation = (key: string) =>
    recentRuns.filter((r) => r.automation_key === key);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Zap className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Automations Hub</h1>
          <p className="text-sm text-muted-foreground">
            {enabledCount} of {configs.length} active · {totalRuns} total runs
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {categories.map((cat) => {
          const meta = categoryMeta[cat] || { icon: Bot, label: cat, color: "text-muted-foreground" };
          const Icon = meta.icon;
          const catConfigs = configs.filter((c) => c.category === cat);
          const active = catConfigs.filter((c) => c.enabled).length;
          return (
            <Card key={cat} className="cursor-pointer hover:shadow-sm" onClick={() => setActiveTab(cat)}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn("w-4 h-4", meta.color)} />
                  <span className="text-xs font-medium">{meta.label}</span>
                </div>
                <p className="text-lg font-bold">{active}/{catConfigs.length}</p>
                <p className="text-[10px] text-muted-foreground">active</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="all" className="text-xs">All ({configs.length})</TabsTrigger>
          {categories.map((cat) => {
            const meta = categoryMeta[cat];
            return (
              <TabsTrigger key={cat} value={cat} className="text-xs">
                {meta?.label || cat} ({configs.filter((c) => c.category === cat).length})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeTab}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredConfigs.map((config) => (
              <AutomationCard
                key={config.id}
                config={config}
                runs={getRunsForAutomation(config.automation_key)}
                onToggle={(key, enabled) => toggleAutomation.mutate({ key, enabled })}
                onTrigger={(key) => triggerAutomation.mutate(key)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Recent Activity */}
      {recentRuns.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Recent Automation Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentRuns.slice(0, 20).map((run) => {
                const StatusIcon = statusIcons[run.status] || Clock;
                return (
                  <div key={run.id} className="flex items-center gap-3 text-xs py-1 border-b border-border last:border-0">
                    <StatusIcon className={cn("w-4 h-4 shrink-0", statusColors[run.status])} />
                    <span className="font-medium truncate">{run.automation_name}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{run.agent_name}</Badge>
                    <span className="text-muted-foreground shrink-0">
                      {run.items_succeeded}/{run.items_processed}
                    </span>
                    <span className="text-muted-foreground ml-auto shrink-0">
                      {new Date(run.started_at).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
