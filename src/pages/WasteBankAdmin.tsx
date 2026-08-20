import { useState } from "react";
import { useWasteBank } from "@/hooks/useWasteBank";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Recycle, Package, CheckCircle2, Archive } from "lucide-react";
import { format } from "date-fns";

export default function WasteBankAdmin() {
  const [tab, setTab] = useState("available");
  const { data: pieces = [], isLoading } = useWasteBank(tab);

  // Compute summary counts across all statuses
  const { data: allPieces = [] } = useWasteBank("all");
  const available = allPieces.filter(p => p.status === "available");
  const reserved = allPieces.filter(p => p.status === "reserved");
  const consumed = allPieces.filter(p => p.status === "consumed");

  const statusBadge = (status: string) => {
    switch (status) {
      case "available": return <Badge variant="default" className="bg-green-600">{status}</Badge>;
      case "reserved": return <Badge variant="secondary" className="bg-amber-600 text-white">{status}</Badge>;
      case "consumed": return <Badge variant="outline">{status}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Waste Bank</h1>
        <p className="text-sm text-muted-foreground">Remnant pieces from cutting operations</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold font-mono">{available.reduce((s, p) => s + p.quantity, 0)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Available</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Archive className="w-8 h-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold font-mono">{reserved.reduce((s, p) => s + p.quantity, 0)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Reserved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold font-mono">{consumed.reduce((s, p) => s + p.quantity, 0)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Consumed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Table */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="reserved">Reserved</TabsTrigger>
          <TabsTrigger value="consumed">Consumed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4">Loading…</p>
          ) : pieces.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Recycle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No {tab === "all" ? "" : tab} pieces found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Bar Code</th>
                    <th className="text-right p-3 font-medium">Length (mm)</th>
                    <th className="text-right p-3 font-medium">Qty</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Location</th>
                    <th className="text-left p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {pieces.map(p => (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold">{p.bar_code}</td>
                      <td className="p-3 text-right font-mono">{p.length_mm.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono">{p.quantity}</td>
                      <td className="p-3 text-center">{statusBadge(p.status)}</td>
                      <td className="p-3 text-muted-foreground">{p.location || "—"}</td>
                      <td className="p-3 text-muted-foreground">{format(new Date(p.created_at), "MMM d, HH:mm")}</td>
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
