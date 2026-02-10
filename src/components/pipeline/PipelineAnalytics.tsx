import { useMemo } from "react";
import { DollarSign, TrendingUp, Target, BarChart3 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

interface PipelineAnalyticsProps {
  leads: Lead[];
}

export function PipelineAnalytics({ leads }: PipelineAnalyticsProps) {
  const stats = useMemo(() => {
    const total = leads.length;
    const totalValue = leads.reduce((sum, l) => sum + (l.expected_value || 0), 0);
    const wonLeads = leads.filter((l) => l.stage === "won");
    const wonValue = wonLeads.reduce((sum, l) => sum + (l.expected_value || 0), 0);
    const winRate = total > 0 ? Math.round((wonLeads.length / total) * 100) : 0;
    const avgDealSize = total > 0 ? Math.round(totalValue / total) : 0;
    const weightedValue = leads.reduce(
      (sum, l) => sum + ((l.expected_value || 0) * (l.probability ?? 0)) / 100,
      0
    );

    return [
      {
        label: "Pipeline Value",
        value: `$${totalValue.toLocaleString()}`,
        icon: DollarSign,
        accent: "text-primary",
      },
      {
        label: "Weighted Forecast",
        value: `$${Math.round(weightedValue).toLocaleString()}`,
        icon: Target,
        accent: "text-green-500",
      },
      {
        label: "Win Rate",
        value: `${winRate}%`,
        icon: TrendingUp,
        accent: "text-blue-500",
      },
      {
        label: "Avg Deal",
        value: `$${avgDealSize.toLocaleString()}`,
        icon: BarChart3,
        accent: "text-amber-500",
      },
    ];
  }, [leads]);

  return (
    <div className="flex items-center gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50 shrink-0"
          title={stat.label}
        >
          <stat.icon className={`w-3 h-3 ${stat.accent}`} />
          <span className="text-xs font-semibold">{stat.value}</span>
          <span className="text-[10px] text-muted-foreground hidden xl:inline">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
