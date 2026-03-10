import { useState } from "react";
import { useBendBatches, type BendBatch } from "@/hooks/useBendBatches";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Wrench, Clock, CheckCircle2, PauseCircle } from "lucide-react";
import { format } from "date-fns";

const statusColor: Record<string, string> = {
  queued: "bg-blue-600",
  bending: "bg-amber-600",
  paused: "bg-orange-500",
  bend_complete: "bg-green-600",
  cancelled: "bg-muted text-muted-foreground",
};

export default function BendQueueAdmin() {
  const [tab, setTab] = useState("queued");
  const { data: items = [], isLoading } = useBendBatches(tab);
  const { data: all = [] } = useBendBatches("all");

  const counts = {
    queued: all.filter(b => b.status === "queued").length,
    bending: all.filter(b => b.status === "bending").length,
    complete: all.filter(b => b.status === "bend_complete").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bend Queue</h1>
        <p className="text-sm text-muted-foreground">Bend batches derived from cut-complete production</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Clock className="w-8 h-8 text-blue-500" />
          <div><p className="text-2xl font-bold font-mono">{counts.queued}</p><p className="text-xs text-muted-foreground uppercase tracking-wider">Queued</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Wrench className="w-8 h-8 text-amber-500" />
          <div><p className="text-2xl font-bold font-mono">{counts.bending}</p><p className="text-xs text-muted-foreground uppercase tracking-wider">Bending</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
          <div><p className="text-2xl font-bold font-mono">{counts.complete}</p><p className="text-xs text-muted-foreground uppercase tracking-wider">Complete</p></div>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="queued">Queued</TabsTrigger>
          <TabsTrigger value="bending">Bending</TabsTrigger>
          <TabsTrigger value="bend_complete">Complete</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4">Loading…</p>
          ) : items.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <PauseCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No bend batches found</p>
            </CardContent></Card>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Size</th>
                    <th className="text-left p-3 font-medium">Shape</th>
                    <th className="text-right p-3 font-medium">Planned</th>
                    <th className="text-right p-3 font-medium">Actual</th>
                    <th className="text-right p-3 font-medium">Variance</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Cut Batch</th>
                    <th className="text-left p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(b => (
                    <tr key={b.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold">{b.size || "—"}</td>
                      <td className="p-3">{b.shape || "—"}</td>
                      <td className="p-3 text-right font-mono">{b.planned_qty}</td>
                      <td className="p-3 text-right font-mono">{b.actual_qty ?? "—"}</td>
                      <td className="p-3 text-right font-mono">{b.variance != null ? (b.variance > 0 ? `+${b.variance}` : b.variance) : "—"}</td>
                      <td className="p-3 text-center">
                        <Badge className={statusColor[b.status] || ""}>{b.status}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-xs">{b.source_cut_batch_id?.slice(0, 8) || "—"}</td>
                      <td className="p-3 text-muted-foreground">{format(new Date(b.created_at), "MMM d, HH:mm")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
