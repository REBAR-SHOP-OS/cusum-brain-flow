import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Sparkles } from "lucide-react";

const stockLengths = [6000, 12000, 18000];

export function OptimizationView() {
  const [selectedStock, setSelectedStock] = useState(12000);
  const [selectedPlan, setSelectedPlan] = useState<"standard" | "optimized" | null>(null);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black italic text-foreground uppercase">Supervisor Hub</h1>
          <p className="text-xs tracking-widest text-primary/70 uppercase">Cross-Strategy Logic Comparison</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">Stock:</span>
          {stockLengths.map((len) => (
            <Button
              key={len}
              variant={selectedStock === len ? "default" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() => setSelectedStock(len)}
            >
              {len}MM
            </Button>
          ))}
        </div>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Standard Plan */}
        <Card
          className={`border-2 transition-all cursor-pointer ${
            selectedPlan === "standard"
              ? "border-primary shadow-[0_0_30px_-10px_hsl(var(--primary)/0.4)]"
              : "border-border hover:border-primary/40"
          }`}
          onClick={() => setSelectedPlan("standard")}
        >
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="text-right">
                <p className="text-[10px] tracking-widest text-primary uppercase">Efficiency</p>
                <p className="text-3xl font-black italic text-primary">96.1%</p>
              </div>
            </div>

            <h2 className="text-xl font-black text-foreground uppercase">Standard</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs tracking-widest text-muted-foreground uppercase">Stoppers/Moves</span>
                <span className="text-xl font-bold text-foreground">57</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs tracking-widest text-muted-foreground uppercase">Total Cycles</span>
                <span className="text-xl font-bold text-foreground">46</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs tracking-widest text-muted-foreground uppercase">Net Waste</span>
                <span className="text-xl font-bold text-primary">17.03 KG</span>
              </div>
            </div>

            <Button
              className="w-full"
              variant={selectedPlan === "standard" ? "default" : "outline"}
            >
              Select This Plan
            </Button>
          </CardContent>
        </Card>

        {/* Optimized Plan */}
        <Card
          className={`border-2 transition-all cursor-pointer ${
            selectedPlan === "optimized"
              ? "border-primary shadow-[0_0_30px_-10px_hsl(var(--primary)/0.4)]"
              : "border-border hover:border-primary/40"
          }`}
          onClick={() => setSelectedPlan("optimized")}
        >
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="text-right">
                <p className="text-[10px] tracking-widest text-primary uppercase">Efficiency</p>
                <p className="text-3xl font-black italic text-primary">98.2%</p>
              </div>
            </div>

            <h2 className="text-xl font-black text-muted-foreground uppercase">Optimized</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs tracking-widest text-muted-foreground uppercase">Stoppers/Moves</span>
                <span className="text-xl font-bold text-muted-foreground">57</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs tracking-widest text-muted-foreground uppercase">Total Cycles</span>
                <span className="text-xl font-bold text-muted-foreground">45</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs tracking-widest text-muted-foreground uppercase">Net Waste</span>
                <span className="text-xl font-bold text-muted-foreground">7.61KG</span>
              </div>
            </div>

            <Button
              className="w-full"
              variant={selectedPlan === "optimized" ? "default" : "outline"}
              disabled={selectedPlan !== "optimized"}
            >
              {selectedPlan === "optimized" ? "Select This Plan" : "Select This Plan"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
