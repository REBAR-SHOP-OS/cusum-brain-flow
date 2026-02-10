import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { mockARAgingBuckets } from "../mockData";
import { motion } from "framer-motion";

interface Props { open: boolean; onClose: () => void; outstandingAR: number; unpaidInvoices: number; }

const barColors = ["hsl(var(--success))", "hsl(var(--primary))", "hsl(var(--warning))", "hsl(210,80%,55%)", "hsl(var(--destructive))"];

export function ARWorkbenchDrawer({ open, onClose, outstandingAR, unpaidInvoices }: Props) {
  const formatCurrency = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[480px] sm:max-w-[480px] bg-card/95 backdrop-blur-xl border-border/50 overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-emerald-500/10"><DollarSign className="w-5 h-5 text-emerald-500" /></div>
            A/R Workbench
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border/50 bg-muted/20 p-4 text-center">
              <p className="text-2xl font-black">{formatCurrency(outstandingAR)}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Outstanding</p>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border/50 bg-muted/20 p-4 text-center">
              <p className="text-2xl font-black">{unpaidInvoices}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Unpaid Invoices</p>
            </motion.div>
          </div>

          {/* Aging Chart */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aging Buckets</h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockARAgingBuckets} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}K`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`$${v.toLocaleString()}`, "Amount"]} />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={32}>
                    {mockARAgingBuckets.map((_, i) => <Cell key={i} fill={barColors[i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Overdue */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top Overdue Invoices</h3>
            <div className="space-y-2">
              {[
                { inv: "#4821", customer: "Acme Builders", amount: 12400, days: 45 },
                { inv: "#4790", customer: "Delta Rebar", amount: 6100, days: 22 },
                { inv: "#4812", customer: "Summit Steel", amount: 4800, days: 18 },
              ].map((inv) => (
                <div key={inv.inv} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/10">
                  <div>
                    <p className="text-sm font-medium">{inv.inv} — {inv.customer}</p>
                    <p className="text-xs text-muted-foreground">{inv.days} days overdue</p>
                  </div>
                  <Badge variant="outline" className="text-destructive border-destructive/40 text-xs">
                    ${inv.amount.toLocaleString()}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
