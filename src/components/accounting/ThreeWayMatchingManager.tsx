import { useState } from "react";
import { useThreeWayMatching, type ThreeWayMatch } from "@/hooks/useThreeWayMatching";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, CheckCircle2, XCircle, AlertTriangle, Link2, Loader2,
  FileText, Package, Receipt, ArrowRight,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: any }> = {
  pending: { variant: "outline", label: "Pending", icon: AlertTriangle },
  matched: { variant: "secondary", label: "Matched", icon: Link2 },
  variance: { variant: "destructive", label: "Variance", icon: AlertTriangle },
  approved: { variant: "default", label: "Approved", icon: CheckCircle2 },
  rejected: { variant: "destructive", label: "Rejected", icon: XCircle },
};

export function ThreeWayMatchingManager() {
  const { purchaseOrders, receipts, matches, isLoading, createMatch, updateMatch } = useThreeWayMatching();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("all");
  const [newMatch, setNewMatch] = useState({ purchase_order_id: "", goods_receipt_id: "", bill_quickbooks_id: "", notes: "" });

  const handleCreate = () => {
    if (!newMatch.purchase_order_id) return;
    createMatch.mutate({
      purchase_order_id: newMatch.purchase_order_id,
      goods_receipt_id: newMatch.goods_receipt_id || undefined,
      bill_quickbooks_id: newMatch.bill_quickbooks_id || undefined,
      notes: newMatch.notes || undefined,
    }, {
      onSuccess: () => {
        setShowCreate(false);
        setNewMatch({ purchase_order_id: "", goods_receipt_id: "", bill_quickbooks_id: "", notes: "" });
      },
    });
  };

  const filtered = filter === "all" ? matches : matches.filter((m) => m.match_status === filter);

  const stats = {
    total: matches.length,
    pending: matches.filter((m) => m.match_status === "pending").length,
    matched: matches.filter((m) => m.match_status === "matched").length,
    variance: matches.filter((m) => m.match_status === "variance").length,
    approved: matches.filter((m) => m.match_status === "approved").length,
  };

  const getPONumber = (poId: string) => purchaseOrders.find((p) => p.id === poId)?.po_number || poId.slice(0, 8);
  const getReceiptNumber = (rId: string) => receipts.find((r) => r.id === rId)?.receipt_number || "—";

  const availableReceipts = newMatch.purchase_order_id
    ? receipts.filter((r) => r.purchase_order_id === newMatch.purchase_order_id)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Link2 className="w-5 h-5" /> 3-Way Matching</h2>
          <p className="text-sm text-muted-foreground">Match Purchase Orders → Goods Receipts → Vendor Bills</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> New Match</Button>
      </div>

      {/* Flow diagram */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-3 text-sm">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted">
              <FileText className="w-4 h-4 text-primary" />
              <span className="font-medium">Purchase Order</span>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted">
              <Package className="w-4 h-4 text-primary" />
              <span className="font-medium">Goods Receipt</span>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted">
              <Receipt className="w-4 h-4 text-primary" />
              <span className="font-medium">Vendor Bill</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, f: "all" },
          { label: "Pending", value: stats.pending, f: "pending", color: "text-amber-500" },
          { label: "Matched", value: stats.matched, f: "matched" },
          { label: "Variance", value: stats.variance, f: "variance", color: "text-destructive" },
          { label: "Approved", value: stats.approved, f: "approved", color: "text-emerald-500" },
        ].map((s) => (
          <Card key={s.f} className="cursor-pointer hover:bg-muted/30" onClick={() => setFilter(s.f)}>
            <CardContent className="pt-3 pb-2">
              <p className="text-[10px] uppercase text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold ${s.color || ""}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1">
        {["all", "pending", "matched", "variance", "approved", "rejected"].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "ghost"} className="text-xs capitalize" onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>

      {/* Matches list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Link2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No match records found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((match) => {
            const cfg = STATUS_CONFIG[match.match_status] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            return (
              <Card key={match.id} className="hover:bg-muted/20 transition-colors">
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <Badge variant={cfg.variant} className="gap-1 text-[10px]">
                      <Icon className="w-3 h-3" /> {cfg.label}
                    </Badge>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">
                        PO: {getPONumber(match.purchase_order_id)}
                        {match.goods_receipt_id && <span className="text-muted-foreground"> → GR: {getReceiptNumber(match.goods_receipt_id)}</span>}
                        {match.bill_quickbooks_id && <span className="text-muted-foreground"> → Bill: {match.bill_quickbooks_id}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(match.created_at).toLocaleDateString()}
                        {match.notes && ` • ${match.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(match.match_status === "matched" || match.match_status === "pending") && (
                      <>
                        <Button size="sm" variant="default" onClick={() => updateMatch.mutate({ id: match.id, match_status: "approved" })}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => updateMatch.mutate({ id: match.id, match_status: "rejected" })}>
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create 3-Way Match</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Purchase Order</Label>
              <Select value={newMatch.purchase_order_id} onValueChange={(v) => setNewMatch({ ...newMatch, purchase_order_id: v, goods_receipt_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((po) => (
                    <SelectItem key={po.id} value={po.id}>{po.po_number} — {po.supplier_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Goods Receipt (optional)</Label>
              <Select value={newMatch.goods_receipt_id} onValueChange={(v) => setNewMatch({ ...newMatch, goods_receipt_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select receipt" /></SelectTrigger>
                <SelectContent>
                  {availableReceipts.length === 0 ? (
                    <SelectItem value="none" disabled>No receipts for this PO</SelectItem>
                  ) : (
                    availableReceipts.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.receipt_number} — {r.received_date}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vendor Bill QB ID (optional)</Label>
              <Input value={newMatch.bill_quickbooks_id} onChange={(e) => setNewMatch({ ...newMatch, bill_quickbooks_id: e.target.value })} placeholder="e.g. 1234" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={newMatch.notes} onChange={(e) => setNewMatch({ ...newMatch, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newMatch.purchase_order_id || createMatch.isPending}>
              {createMatch.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Create Match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
