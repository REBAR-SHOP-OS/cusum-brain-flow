import { useState } from "react";
import { CutPlan, CutPlanItem, RebarSize, MachineCapability, MachineOption } from "@/hooks/useCutPlans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { AddItemForm } from "./AddItemForm";
import { QueueToMachineDialog } from "./QueueToMachineDialog";
import { Trash2, Send, FileText } from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  queued: "bg-yellow-500/20 text-yellow-500",
  running: "bg-blue-500/20 text-blue-500",
  completed: "bg-green-500/20 text-green-500",
  canceled: "bg-destructive/20 text-destructive",
};

interface CutPlanDetailsProps {
  plan: CutPlan;
  items: CutPlanItem[];
  itemsLoading: boolean;
  rebarSizes: RebarSize[];
  capabilities: MachineCapability[];
  getMaxBars: (barCode: string) => number | null;
  machines: MachineOption[];
  canWrite: boolean;
  onAddItem: (item: Omit<CutPlanItem, "id">) => Promise<boolean>;
  onRemoveItem: (itemId: string) => Promise<boolean>;
  onQueued: () => void;
}

export function CutPlanDetails({
  plan, items, itemsLoading, rebarSizes, capabilities, getMaxBars,
  machines, canWrite, onAddItem, onRemoveItem, onQueued
}: CutPlanDetailsProps) {
  const [queueOpen, setQueueOpen] = useState(false);

  const handleAdd = async (barCode: string, qtyBars: number, cutLengthMm: number, piecesPerBar: number) => {
    await onAddItem({
      cut_plan_id: plan.id,
      bar_code: barCode,
      qty_bars: qtyBars,
      cut_length_mm: cutLengthMm,
      pieces_per_bar: piecesPerBar,
      notes: null,
    });
  };

  const isDraft = plan.status === "draft";
  const totalBars = items.reduce((s, i) => s + i.qty_bars, 0);
  const totalPieces = items.reduce((s, i) => s + i.qty_bars * i.pieces_per_bar, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
          <h2 className="text-sm font-semibold truncate">{plan.name}</h2>
          <Badge className={statusColors[plan.status] || statusColors.draft}>
            {plan.status}
          </Badge>
        </div>
        {canWrite && isDraft && items.length > 0 && (
          <Button size="sm" className="gap-1 shrink-0" onClick={() => setQueueOpen(true)}>
            <Send className="w-3.5 h-3.5" /> Queue to Machine
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="px-4 py-2 border-b border-border bg-muted/30 flex gap-4 text-xs text-muted-foreground">
        <span>{items.length} item(s)</span>
        <span>{totalBars} total bars</span>
        <span>{totalPieces} total pieces</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Add Item Form (only for draft + write access) */}
          {canWrite && isDraft && (
            <AddItemForm
              rebarSizes={rebarSizes}
              capabilities={capabilities}
              getMaxBars={getMaxBars}
              onAdd={handleAdd}
            />
          )}

          {/* Items List */}
          {itemsLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading items…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No items yet. {canWrite && isDraft ? "Add items above." : ""}
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const size = rebarSizes.find(s => s.bar_code === item.bar_code);
                const totalWeight = size
                  ? (item.cut_length_mm / 1000) * size.mass_kg_per_m * item.qty_bars * item.pieces_per_bar
                  : null;

                return (
                  <Card key={item.id} className="hover:bg-muted/30 transition-colors">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-xs">{item.bar_code}</Badge>
                          <span className="text-sm">
                            {item.qty_bars} bar{item.qty_bars !== 1 ? "s" : ""} × {item.pieces_per_bar} pc @ {item.cut_length_mm}mm
                          </span>
                        </div>
                        {size && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ⌀{size.diameter_mm}mm • {totalWeight?.toFixed(1)} kg total
                          </p>
                        )}
                      </div>
                      {canWrite && isDraft && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => onRemoveItem(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Queue Dialog */}
      <QueueToMachineDialog
        open={queueOpen}
        onOpenChange={setQueueOpen}
        plan={plan}
        items={items}
        machines={machines}
        onQueued={onQueued}
      />
    </div>
  );
}
