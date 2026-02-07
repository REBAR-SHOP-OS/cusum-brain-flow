import { Card, CardContent } from "@/components/ui/card";
import { Activity, Package, Truck, Users, TrendingUp, Clock } from "lucide-react";

const stats = [
  { label: "Active Jobs", value: "3", icon: Activity, color: "text-primary" },
  { label: "Total Mark IDs", value: "159", icon: Package, color: "text-blue-500" },
  { label: "Tonnage (KG)", value: "2,614", icon: TrendingUp, color: "text-green-500" },
  { label: "Deliveries Pending", value: "5", icon: Truck, color: "text-yellow-500" },
  { label: "Team Online", value: "8", icon: Users, color: "text-purple-500" },
  { label: "Run Time Today", value: "6h 24m", icon: Clock, color: "text-orange-500" },
];

export function CEODashboardView() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black italic text-foreground">CEO DASHBOARD</h1>
        <p className="text-sm text-muted-foreground">Overview of operations</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-card border-border">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground text-center py-12">
            Detailed analytics, charts, and KPI tracking coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
