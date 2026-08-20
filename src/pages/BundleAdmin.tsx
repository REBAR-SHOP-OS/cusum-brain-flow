import { useState } from "react";
import { useBundles, type Bundle } from "@/hooks/useBundles";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Package, Truck, CheckCircle2, Box } from "lucide-react";
import { format } from "date-fns";

const statusColor: Record<string, string> = {
  created: "bg-blue-600",
  staged: "bg-amber-600",
  loaded: "bg-primary",
  delivered: "bg-green-600",
  cancelled: "bg-muted text-muted-foreground",
};

export default function BundleAdmin() {
  const [tab, setTab] = useState("created");
  const { data: items = [], isLoading } = useBundles(tab);
  const { data: all = [] } = useBundles("all");

  const counts = {
    created: all.filter(b => b.status === "created").length,
    staged: all.filter(b => b.status === "staged").length,
    delivered: all.filter(b => b.status === "delivered").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bundles</h1>
        <p className="text-sm text-muted-foreground">Production bundles from bend-complete batches</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Package className="w-8 h-8 text-blue-500" />
          <div><p className="text-2xl font-bold font-mono">{counts.created}</p><p className="text-xs text-muted-foreground uppercase tracking-wider">Created</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Box className="w-8 h-8 text-amber-500" />
          <div><p className="text-2xl font-bold font-mono">{counts.staged}</p><p className="text-xs text-muted-foreground uppercase tracking-wider">Staged</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Truck className="w-8 h-8 text-green-500" />
          <div><p className="text-2xl font-bold font-mono">{counts.delivered}</p><p className="text-xs text-muted-foreground uppercase tracking-wider">Delivered</p></div>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="created">Created</TabsTrigger>
          <TabsTrigger value="staged">Staged</TabsTrigger>
          <TabsTrigger value="loaded">Loaded</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4">Loading…</p>
          ) : items.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No bundles found</p>
            </CardContent></Card>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Bundle Code</th>
                    <th className="text-left p-3 font-medium">Size</th>
                    <th className="text-left p-3 font-medium">Shape</th>
                    <th className="text-right p-3 font-medium">Qty</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Bend Batch</th>
                    <th className="text-left p-3 font-medium">Cut Batch</th>
                    <th className="text-left p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(b => (
                    <tr key={b.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold">{b.bundle_code || "—"}</td>
                      <td className="p-3 font-mono">{b.size || "—"}</td>
                      <td className="p-3">{b.shape || "—"}</td>
                      <td className="p-3 text-right font-mono">{b.quantity}</td>
                      <td className="p-3 text-center">
                        <Badge className={statusColor[b.status] || ""}>{b.status}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-xs">{b.source_bend_batch_id?.slice(0, 8) || "—"}</td>
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
