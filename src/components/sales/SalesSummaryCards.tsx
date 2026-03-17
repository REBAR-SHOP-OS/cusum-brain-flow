import { cn } from "@/lib/utils";

export interface SummaryCardData {
  label: string;
  value: string | number;
  sub?: string;
  color?: string; // tailwind text color class using semantic tokens
}

interface SalesSummaryCardsProps {
  cards: SummaryCardData[];
}

export default function SalesSummaryCards({ cards }: SalesSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {cards.map((c, i) => (
        <div key={i} className="rounded-lg border border-border/50 bg-card/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{c.label}</p>
          <p className={cn("text-lg font-bold mt-0.5", c.color || "text-foreground")}>{c.value}</p>
          {c.sub && <p className="text-[10px] text-muted-foreground">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}
