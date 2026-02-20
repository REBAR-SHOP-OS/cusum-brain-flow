import { useCallAnalytics } from "@/hooks/useCallAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

interface CallAnalyticsDashboardProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CallAnalyticsDashboard({ open, onOpenChange }: CallAnalyticsDashboardProps = {}) {
  const { analytics, loading } = useCallAnalytics(30);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading call analytics...
      </div>
    );
  }

  const outcomeData = Object.entries(analytics.outcomeDistribution).map(([name, value]) => ({
    name,
    value,
  }));

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const content = (
    <div className="space-y-6 p-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Calls</span>
            </div>
            <p className="text-2xl font-bold">{analytics.totalCalls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <PhoneIncoming className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Inbound</span>
            </div>
            <p className="text-2xl font-bold">{analytics.totalInbound}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <PhoneMissed className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Missed Rate</span>
            </div>
            <p className="text-2xl font-bold">{analytics.missedRate}%</p>
            <p className="text-xs text-muted-foreground">{analytics.missedCalls} missed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Avg Duration</span>
            </div>
            <p className="text-2xl font-bold">{formatDuration(analytics.avgDuration)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Call Volume (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.dailyVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.dailyVolume}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="inbound" fill="hsl(var(--chart-2))" name="Inbound" stackId="a" />
                <Bar dataKey="outbound" fill="hsl(var(--primary))" name="Outbound" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No call data available</p>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Outcome Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Call Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            {outcomeData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={outcomeData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value">
                      {outcomeData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1">
                  {outcomeData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Top Callers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topCallers.length > 0 ? (
              <div className="space-y-2">
                {analytics.topCallers.slice(0, 5).map((caller) => (
                  <div key={caller.phone} className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted-foreground">{caller.phone}</span>
                    <Badge variant="secondary">{caller.count} calls</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (open !== undefined && onOpenChange) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Call Analytics</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return content;
}
