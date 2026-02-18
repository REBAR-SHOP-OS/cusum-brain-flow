import { useState, useMemo } from "react";
import { useBudgets, Budget } from "@/hooks/useBudgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown, Target, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const pctFmt = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%";

interface ActualEntry {
  name: string;
  category: string;
  months: number[];
}

// Placeholder actuals — in production you'd pull from accounting_mirror or QuickBooks
function useActuals(_year: number): ActualEntry[] {
  return [];
}

export function BudgetVsActuals() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { budgets, isLoading } = useBudgets(year);
  const actuals = useActuals(year);
  const currentMonth = new Date().getMonth();

  // Group budgets by category
  const categories = useMemo(() => {
    const cats: Record<string, { budgets: Budget[]; actuals: ActualEntry[] }> = {};
    budgets.forEach(b => {
      const cat = b.account_category || "other";
      if (!cats[cat]) cats[cat] = { budgets: [], actuals: [] };
      cats[cat].budgets.push(b);
    });
    actuals.forEach(a => {
      if (!cats[a.category]) cats[a.category] = { budgets: [], actuals: [] };
      cats[a.category].actuals.push(a);
    });
    return cats;
  }, [budgets, actuals]);

  // Monthly chart data
  const chartData = useMemo(() => {
    return MONTH_LABELS.map((label, i) => {
      const key = MONTH_KEYS[i];
      const budgeted = budgets.reduce((s, b) => s + Number(b[key] || 0), 0);
      // Find matching actuals
      const actual = actuals.reduce((s, a) => s + (a.months[i] || 0), 0);
      return { month: label, Budget: budgeted, Actual: actual };
    });
  }, [budgets, actuals]);

  // Summary stats
  const totalBudgetYTD = budgets.reduce((s, b) => 
    s + MONTH_KEYS.slice(0, currentMonth + 1).reduce((ms, k) => ms + Number(b[k] || 0), 0), 0);
  const totalActualYTD = actuals.reduce((s, a) => 
    s + a.months.slice(0, currentMonth + 1).reduce((ms, v) => ms + v, 0), 0);
  const varianceYTD = totalActualYTD - totalBudgetYTD;
  const variancePct = totalBudgetYTD > 0 ? (varianceYTD / totalBudgetYTD) * 100 : 0;

  const totalBudgetAnnual = budgets.reduce((s, b) => 
    s + MONTH_KEYS.reduce((ms, k) => ms + Number(b[k] || 0), 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> Budget vs. Actuals
          </h2>
          <p className="text-sm text-muted-foreground">Track spending against budget with variance analysis</p>
        </div>
        <Select value={String(year)} onValueChange={v => setYear(+v)}>
          <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Annual Budget</p>
            <p className="text-2xl font-bold mt-1">{fmt(totalBudgetAnnual)}</p>
            <p className="text-xs text-muted-foreground">{budgets.length} line items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">YTD Budget</p>
            <p className="text-2xl font-bold mt-1">{fmt(totalBudgetYTD)}</p>
            <p className="text-xs text-muted-foreground">Through {MONTH_LABELS[currentMonth]}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">YTD Actual</p>
            <p className="text-2xl font-bold mt-1">{fmt(totalActualYTD)}</p>
            <p className="text-xs text-muted-foreground">
              {totalActualYTD === 0 ? "No actuals entered yet" : `Through ${MONTH_LABELS[currentMonth]}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">YTD Variance</p>
            <div className="flex items-center gap-2 mt-1">
              {varianceYTD === 0 ? (
                <p className="text-2xl font-bold text-muted-foreground">—</p>
              ) : (
                <>
                  <p className={cn("text-2xl font-bold", varianceYTD > 0 ? "text-destructive" : "text-emerald-600")}>
                    {fmt(Math.abs(varianceYTD))}
                  </p>
                  {varianceYTD > 0 ? (
                    <TrendingUp className="w-5 h-5 text-destructive" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-emerald-600" />
                  )}
                </>
              )}
            </div>
            {varianceYTD !== 0 && (
              <p className={cn("text-xs", varianceYTD > 0 ? "text-destructive" : "text-emerald-600")}>
                {pctFmt(variancePct)} {varianceYTD > 0 ? "over budget" : "under budget"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Monthly Budget vs. Actual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="Budget" fill="hsl(var(--primary))" opacity={0.3} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Variance Detail by Line Item</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Budget Line</TableHead>
                  <TableHead className="min-w-[80px]">Category</TableHead>
                  <TableHead className="text-right min-w-[100px]">Annual Budget</TableHead>
                  <TableHead className="text-right min-w-[100px]">YTD Budget</TableHead>
                  <TableHead className="text-right min-w-[100px]">YTD Actual</TableHead>
                  <TableHead className="text-right min-w-[100px]">Variance ($)</TableHead>
                  <TableHead className="text-right min-w-[80px]">Variance %</TableHead>
                  <TableHead className="min-w-[80px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : budgets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No budgets for {year}. Create budgets in Budget Management first.
                    </TableCell>
                  </TableRow>
                ) : budgets.map(b => {
                  const annual = MONTH_KEYS.reduce((s, k) => s + Number(b[k] || 0), 0);
                  const ytdBudget = MONTH_KEYS.slice(0, currentMonth + 1).reduce((s, k) => s + Number(b[k] || 0), 0);
                  // Match actuals by name
                  const matchedActual = actuals.find(a => a.name === b.name);
                  const ytdActual = matchedActual
                    ? matchedActual.months.slice(0, currentMonth + 1).reduce((s, v) => s + v, 0)
                    : 0;
                  const variance = ytdActual - ytdBudget;
                  const varPct = ytdBudget > 0 ? (variance / ytdBudget) * 100 : 0;
                  const isOver = variance > 0;
                  const isSignificant = Math.abs(varPct) > 10;

                  return (
                    <TableRow key={b.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">{b.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs capitalize">{b.account_category || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(annual)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(ytdBudget)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {ytdActual > 0 ? fmt(ytdActual) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className={cn("text-right tabular-nums font-medium", 
                        ytdActual === 0 ? "text-muted-foreground" : isOver ? "text-destructive" : "text-emerald-600"
                      )}>
                        {ytdActual === 0 ? "—" : fmt(variance)}
                      </TableCell>
                      <TableCell className={cn("text-right tabular-nums",
                        ytdActual === 0 ? "text-muted-foreground" : isOver ? "text-destructive" : "text-emerald-600"
                      )}>
                        {ytdActual === 0 ? "—" : pctFmt(varPct)}
                      </TableCell>
                      <TableCell>
                        {ytdActual === 0 ? (
                          <Badge variant="outline" className="text-[10px]">No data</Badge>
                        ) : isSignificant && isOver ? (
                          <Badge variant="destructive" className="text-[10px] gap-0.5">
                            <AlertTriangle className="w-3 h-3" /> Over
                          </Badge>
                        ) : isOver ? (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Caution</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">On track</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {Object.keys(categories).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Variance by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(categories).map(([cat, { budgets: catBudgets, actuals: catActuals }]) => {
                const catBudgetYTD = catBudgets.reduce((s, b) => 
                  s + MONTH_KEYS.slice(0, currentMonth + 1).reduce((ms, k) => ms + Number(b[k] || 0), 0), 0);
                const catActualYTD = catActuals.reduce((s, a) => 
                  s + a.months.slice(0, currentMonth + 1).reduce((ms, v) => ms + v, 0), 0);
                const catVar = catActualYTD - catBudgetYTD;
                const catPct = catBudgetYTD > 0 ? (catVar / catBudgetYTD) * 100 : 0;
                const catAnnual = catBudgets.reduce((s, b) => 
                  s + MONTH_KEYS.reduce((ms, k) => ms + Number(b[k] || 0), 0), 0);

                return (
                  <div key={cat} className="p-3 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold capitalize">{cat}</span>
                      <span className="text-xs text-muted-foreground">{catBudgets.length} items</span>
                    </div>
                    <div className="text-xs space-y-0.5 text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Annual Budget</span><span className="font-medium text-foreground">{fmt(catAnnual)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>YTD Budget</span><span>{fmt(catBudgetYTD)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>YTD Actual</span><span>{catActualYTD > 0 ? fmt(catActualYTD) : "—"}</span>
                      </div>
                      {catActualYTD > 0 && (
                        <div className={cn("flex justify-between font-medium", catVar > 0 ? "text-destructive" : "text-emerald-600")}>
                          <span>Variance</span><span>{fmt(catVar)} ({pctFmt(catPct)})</span>
                        </div>
                      )}
                    </div>
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
