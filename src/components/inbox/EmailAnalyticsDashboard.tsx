import { useEmailAnalytics } from "@/hooks/useEmailAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, MailOpen, AlertCircle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

interface EmailAnalyticsDashboardProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EmailAnalyticsDashboard({ open, onOpenChange }: EmailAnalyticsDashboardProps) {
  const { analytics, loading } = useEmailAnalytics(30);

  if (loading) {
    return open ? (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading email analytics...
          </div>
        </DialogContent>
      </Dialog>
    ) : null;
  }

  const categoryData = Object.entries(analytics.categoryDistribution).map(([name, value]) => ({
    name,
    value,
  }));

  const content = (
    <div className="space-y-6 p-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Emails</span>
            </div>
            <p className="text-2xl font-bold">{analytics.totalEmails}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <MailOpen className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Inbound</span>
            </div>
            <p className="text-2xl font-bold">{analytics.totalInbound}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Outbound</span>
            </div>
            <p className="text-2xl font-bold">{analytics.totalOutbound}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Action Required</span>
            </div>
            <p className="text-2xl font-bold">{analytics.actionRequiredRate}%</p>
            <p className="text-xs text-muted-foreground">{analytics.actionRequired} emails</p>
          </CardContent>
        </Card>
      </div>

      {/* Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Email Volume (30 days)</CardTitle>
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
            <p className="text-sm text-muted-foreground text-center py-8">No email data available</p>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Email Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value">
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1">
                  {categoryData.map((item, i) => (
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

        {/* Top Senders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Senders</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topSenders.length > 0 ? (
              <div className="space-y-2">
                {analytics.topSenders.slice(0, 5).map((s) => (
                  <div key={s.sender} className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted-foreground max-w-[200px]">{s.sender}</span>
                    <Badge variant="secondary">{s.count} emails</Badge>
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
            <DialogTitle>Email Analytics</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return content;
}
