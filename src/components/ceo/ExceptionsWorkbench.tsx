import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DollarSign, Settings, TrendingUp, Truck, AlertTriangle, Clock, User, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockExceptions } from "./mockData";
import type { ExceptionItem } from "./types";

const categoryIcons = { cash: DollarSign, ops: Settings, sales: TrendingUp, delivery: Truck };
const severityStyle = {
  critical: "border-destructive/40 bg-destructive/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  info: "border-border bg-muted/20",
};

export function ExceptionsWorkbench() {
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<ExceptionItem | null>(null);

  const filtered = tab === "all" ? mockExceptions : mockExceptions.filter((e) => e.category === tab);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden"
    >
      <div className="p-5 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Exceptions Workbench
          </h2>
          <Badge variant="secondary" className="text-xs">{mockExceptions.length} open</Badge>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/30 border border-border/50">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="cash" className="text-xs">Cash</TabsTrigger>
            <TabsTrigger value="ops" className="text-xs">Ops</TabsTrigger>
            <TabsTrigger value="sales" className="text-xs">Sales</TabsTrigger>
            <TabsTrigger value="delivery" className="text-xs">Delivery</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-5 pt-3 space-y-2 max-h-[320px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {filtered.map((exc, i) => {
            const Icon = categoryIcons[exc.category];
            return (
              <motion.div
                key={exc.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelected(exc)}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/30",
                  severityStyle[exc.severity]
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "p-1.5 rounded-lg shrink-0",
                    exc.severity === "critical" ? "bg-destructive/10" : "bg-muted/50"
                  )}>
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{exc.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {exc.age}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <User className="w-2.5 h-2.5" /> {exc.owner}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-[420px] sm:max-w-[420px] bg-card/95 backdrop-blur-xl border-border/50">
          {selected && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="text-foreground">{selected.title}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{selected.detail}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Age</p>
                    <p className="text-lg font-bold">{selected.age}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Owner</p>
                    <p className="text-lg font-bold">{selected.owner}</p>
                  </div>
                  {selected.customer && (
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Customer</p>
                      <p className="text-sm font-medium">{selected.customer}</p>
                    </div>
                  )}
                  {selected.value && (
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Value</p>
                      <p className="text-lg font-bold">${selected.value.toLocaleString()}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  {selected.actions.map((a) => (
                    <Button key={a.label} variant={a.type === "primary" ? "default" : "outline"} size="sm" className="text-xs"
                      onClick={() => {
                        toast({ title: `${a.label}`, description: `Action "${a.label}" triggered for this exception.` });
                        setSelected(null);
                      }}
                    >
                      {a.label}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
