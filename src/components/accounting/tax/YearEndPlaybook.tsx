import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PLAYBOOK = [
  {
    quarter: "Q3 (Jul-Sep)",
    items: [
      "Review CCA schedule — decide which assets to depreciate this year",
      "Estimate year-end profit — adjust spending if needed",
      "Check HSA claims — use remaining room before year-end",
    ],
  },
  {
    quarter: "Q4 (Oct-Dec)",
    items: [
      "Finalize expense claims — home office, software, professional fees",
      "Decide salary vs. dividend timing — run the calculator",
      "Pre-pay deductible expenses (subscriptions, insurance, education)",
    ],
  },
  {
    quarter: "Year-End",
    items: [
      "HSA top-up — maximize annual limit",
      "Dividend declaration — board resolution + pay before year-end",
      "RRSP contribution (if salary strategy) — by 60 days after year-end",
      "Review GST/HST ITCs — ensure 100% eligible claims filed",
    ],
  },
  {
    quarter: "Post Year-End",
    items: [
      "T2 corporate tax return preparation",
      "Personal T1 tax return with dividend/salary slips",
      "GST/HST annual review and filing",
      "Update CCA schedule for next year",
    ],
  },
];

export function YearEndPlaybook() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">📅 Year-End Tax Playbook</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {PLAYBOOK.map(q => {
          const doneCount = q.items.filter((_, i) => completed.has(`${q.quarter}-${i}`)).length;
          return (
            <div key={q.quarter} className="p-4 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{q.quarter}</h3>
                <Badge variant="outline" className="text-[10px]">{doneCount}/{q.items.length}</Badge>
              </div>
              <div className="space-y-2">
                {q.items.map((item, i) => {
                  const key = `${q.quarter}-${i}`;
                  const done = completed.has(key);
                  return (
                    <button key={key} onClick={() => toggle(key)} className="flex items-center gap-2 w-full text-left">
                      {done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <span className={cn("text-sm", done && "line-through text-muted-foreground")}>{item}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
