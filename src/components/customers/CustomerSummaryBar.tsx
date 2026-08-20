import { Progress } from "@/components/ui/progress";

interface SummaryStat {
  label: string;
  count: number;
  total: number;
  color: string;
}

interface CustomerSummaryBarProps {
  stats: SummaryStat[];
}

function formatCurrency(val: number) {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

export function CustomerSummaryBar({ stats }: CustomerSummaryBarProps) {
  const grandTotal = stats.reduce((s, st) => s + st.total, 0);

  return (
    <div className="space-y-3">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-card p-3 text-center cursor-pointer hover:bg-accent/30 transition-colors"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {stat.label}
            </p>
            <p className="text-lg font-bold mt-1">{formatCurrency(stat.total)}</p>
            {stat.count > 0 && (
              <p className="text-xs text-muted-foreground">{stat.count} item{stat.count !== 1 ? "s" : ""}</p>
            )}
          </div>
        ))}
      </div>

      {/* Proportional Color Bar */}
      {grandTotal > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
          {stats
            .filter((s) => s.total > 0)
            .map((stat) => (
              <div
                key={stat.label}
                className="h-full transition-all"
                style={{
                  width: `${(stat.total / grandTotal) * 100}%`,
                  backgroundColor: stat.color,
                }}
              />
            ))}
        </div>
      )}
    </div>
  );
}
