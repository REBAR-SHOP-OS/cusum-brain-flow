import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";
import type { ARAgingBucket } from "@/hooks/useCEODashboard";

interface Props {
  open: boolean;
  onClose: () => void;
  outstandingAR: number;
  unpaidInvoices: number;
  arAgingBuckets: ARAgingBucket[];
}

const barColors = ["hsl(var(--success))", "hsl(var(--primary))", "hsl(var(--warning))", "hsl(210,80%,55%)", "hsl(var(--destructive))"];

export function ARWorkbenchDrawer({ open, onClose, outstandingAR, unpaidInvoices, arAgingBuckets }: Props) {
  const formatCurrency = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;

  // Top overdue from aging data
  const totalOverdue = arAgingBuckets.slice(1).reduce((s, b) => s + b.amount, 0);
  const overdueCount = arAgingBuckets.slice(1).reduce((s, b) => s + b.count, 0);

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

          {overdueCount > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              ⚠ {overdueCount} invoices overdue totaling {formatCurrency(totalOverdue)}
            </div>
          )}

          {/* Aging Chart */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aging Buckets</h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={arAgingBuckets} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}K`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`$${v.toLocaleString()}`, "Amount"]} />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={32}>
                    {arAgingBuckets.map((_, i) => <Cell key={i} fill={barColors[i] || barColors[4]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bucket Details */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bucket Details</h3>
            <div className="space-y-2">
              {arAgingBuckets.filter(b => b.count > 0).map((b, i) => (
                <div key={b.bucket} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/10">
                  <div>
                    <p className="text-sm font-medium">{b.bucket} days</p>
                    <p className="text-xs text-muted-foreground">{b.count} invoice{b.count !== 1 ? "s" : ""}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs ${i >= 3 ? "text-destructive border-destructive/40" : i >= 2 ? "text-amber-500 border-amber-500/40" : "border-primary/40 text-primary"}`}>
                    ${b.amount.toLocaleString()}
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
