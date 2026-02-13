import { Card, CardContent } from "@/components/ui/card";
import { Palmtree, Thermometer, User } from "lucide-react";
import type { LeaveBalance } from "@/hooks/useLeaveManagement";

interface Props {
  balance: LeaveBalance | null;
}

function ProgressRing({ used, total, color }: { used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg width="72" height="72" className="shrink-0">
      <circle cx="36" cy="36" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={radius} fill="none"
        stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        className="transition-all duration-500"
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" className="fill-foreground text-sm font-bold">
        {total - used}
      </text>
    </svg>
  );
}

const cards = [
  { key: "vacation" as const, label: "Vacation", icon: Palmtree, color: "hsl(var(--primary))" },
  { key: "sick" as const, label: "Sick Days", icon: Thermometer, color: "hsl(25 95% 53%)" },
  { key: "personal" as const, label: "Personal", icon: User, color: "hsl(262 83% 58%)" },
];

export function LeaveBalanceCards({ balance }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map(({ key, label, icon: Icon, color }) => {
        const entitled = balance ? (balance[`${key}_days_entitled` as keyof LeaveBalance] as number) : 0;
        const used = balance ? (balance[`${key}_days_used` as keyof LeaveBalance] as number) : 0;
        const remaining = entitled - used;

        return (
          <Card key={key} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <ProgressRing used={used} total={entitled} color={color} />
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{label}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {remaining} of {entitled} days remaining
                </p>
                <p className="text-xs text-muted-foreground">{used} used</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
