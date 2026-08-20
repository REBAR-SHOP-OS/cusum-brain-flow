import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRebarSizes } from "@/hooks/useCutPlans";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Package, ShoppingCart, FileText, Warehouse, Plus, Trash2, CheckCircle2,
  Loader2, RefreshCw, Truck, AlertCircle,
} from "lucide-react";

/* ───────── types ───────── */

interface InventoryLot {
  id: string;
  bar_code: string;
  standard_length_mm: number;
  qty_on_hand: number;
  qty_reserved: number;
  source: string;
  location: string | null;
  lot_number: string | null;
  created_at: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_name: string;
  status: string;
  order_date: string;
  expected_delivery: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
}

interface POLine {
  id: string;
  purchase_order_id: string;
  bar_code: string;
  standard_length_mm: number;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number | null;
}

/* ───────── hooks ───────── */

function useInventoryLots() {
  return useQuery({
    queryKey: ["inventory-lots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_lots")
        .select("*")
        .order("bar_code")
        .order("standard_length_mm");
      if (error) throw error;
      return (data || []) as InventoryLot[];
    },
  });
}

function usePurchaseOrders() {
  return useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PurchaseOrder[];
    },
  });
}

function usePOLines(poId: string | null) {
  return useQuery({
    queryKey: ["po-lines", poId],
    enabled: !!poId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_lines")
        .select("*")
        .eq("purchase_order_id", poId!);
      if (error) throw error;
      return (data || []) as POLine[];
    },
  });
}

/* ───────── component ───────── */

export function InventoryView() {
  const [tab, setTab] = useState("warehouse");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const rebarSizes = useRebarSizes();

  // Data
  const { data: lots = [], isLoading: lotsLoading, refetch: refetchLots } = useInventoryLots();
  const { data: pos = [], isLoading: posLoading, refetch: refetchPOs } = usePurchaseOrders();

  // PO creation state
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [newPoNumber, setNewPoNumber] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [newExpectedDate, setNewExpectedDate] = useState("");
  const [newLines, setNewLines] = useState<{ bar_code: string; length: number; qty: number; cost: string }[]>([]);
  const [creatingPO, setCreatingPO] = useState(false);

  // Receiving state
  const [receivingPoId, setReceivingPoId] = useState<string | null>(null);
  const { data: receivingLines = [] } = usePOLines(receivingPoId);
  const [receiving, setReceiving] = useState(false);

  // Manual register state
  const [registerSize, setRegisterSize] = useState("10M");
  const [registerLength, setRegisterLength] = useState("12000");
  const [registerQty, setRegisterQty] = useState("");
  const [registering, setRegistering] = useState(false);

  const barCodeOptions = rebarSizes.map((r: any) => r.bar_code as string);

  // Aggregate lots by bar_code + length
  const aggregated = lots.reduce<Record<string, { bar_code: string; length: number; qty: number; reserved: number; source: string }>>((acc, lot) => {
    const key = `${lot.bar_code}_${lot.standard_length_mm}_${lot.source}`;
    if (!acc[key]) {
      acc[key] = { bar_code: lot.bar_code, length: lot.standard_length_mm, qty: 0, reserved: 0, source: lot.source };
    }
    acc[key].qty += lot.qty_on_hand;
    acc[key].reserved += lot.qty_reserved;
    return acc;
  }, {});
  const stockRows = Object.values(aggregated).sort((a, b) => a.bar_code.localeCompare(b.bar_code) || a.length - b.length);

  const remnants = stockRows.filter((r) => r.source === "remnant");
  const rawStock = stockRows.filter((r) => r.source !== "remnant");

  /* ─── Create PO ─── */
  const handleCreatePO = async () => {
    if (!newPoNumber || !newSupplier || !newLines.length) return;
    setCreatingPO(true);
    try {
      // Get company_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile?.company_id) throw new Error("No company assigned");

      const { data: po, error: poErr } = await supabase
        .from("purchase_orders")
        .insert({
          company_id: profile.company_id,
          po_number: newPoNumber,
          supplier_name: newSupplier,
          status: "submitted",
          expected_delivery: newExpectedDate || null,
          created_by: user?.id,
        } as any)
        .select()
        .single();

      if (poErr) throw poErr;

      const lineInserts = newLines.map((l) => ({
        purchase_order_id: (po as any).id,
        bar_code: l.bar_code,
        standard_length_mm: l.length,
        qty_ordered: l.qty,
        unit_cost: l.cost ? parseFloat(l.cost) : null,
      }));

      const { error: lineErr } = await supabase.from("purchase_order_lines").insert(lineInserts as any);
      if (lineErr) throw lineErr;

      toast({ title: "PO Created", description: `${newPoNumber} with ${newLines.length} lines` });
      setShowCreatePO(false);
      setNewPoNumber("");
      setNewSupplier("");
      setNewExpectedDate("");
      setNewLines([]);
      refetchPOs();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreatingPO(false);
    }
  };

  /* ─── Receive PO ─── */
  const handleReceive = async () => {
    if (!receivingPoId) return;
    setReceiving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-inventory", {
        body: { action: "receive-po", purchaseOrderId: receivingPoId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Stock Received",
        description: `${data.totalReceived} bars added to inventory. PO status: ${data.poStatus}`,
      });
      setReceivingPoId(null);
      refetchPOs();
      refetchLots();
    } catch (err: any) {
      toast({ title: "Receive Failed", description: err.message, variant: "destructive" });
    } finally {
      setReceiving(false);
    }
  };

  /* ─── Manual Register ─── */
  const handleManualRegister = async () => {
    const qty = parseInt(registerQty);
    if (!qty || qty <= 0) return;
    setRegistering(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile?.company_id) throw new Error("No company assigned");

      const { error } = await supabase.from("inventory_lots").insert({
        company_id: profile.company_id,
        bar_code: registerSize,
        standard_length_mm: parseInt(registerLength),
        qty_on_hand: qty,
        source: "manual",
        location: "yard",
        lot_number: `MAN-${Date.now().toString(36).toUpperCase()}`,
      } as any);

      if (error) throw error;
      toast({ title: "Stock Registered", description: `${qty}× ${registerSize} @ ${registerLength}mm` });
      setRegisterQty("");
      refetchLots();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRegistering(false);
    }
  };

  const addNewLine = () => {
    setNewLines([...newLines, { bar_code: barCodeOptions[0] || "10M", length: 12000, qty: 0, cost: "" }]);
  };

  return (
    <div className="p-6 space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-center mb-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="warehouse" className="gap-1.5 text-xs">
              <Warehouse className="w-3.5 h-3.5" /> Warehouse
            </TabsTrigger>
            <TabsTrigger value="po-intake" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" /> PO Intake
            </TabsTrigger>
            <TabsTrigger value="receiving" className="gap-1.5 text-xs">
              <Truck className="w-3.5 h-3.5" /> Receiving
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══ Warehouse Tab ═══ */}
        <TabsContent value="warehouse" className="space-y-4">
          <div className="rounded-xl bg-primary p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-black italic text-primary-foreground uppercase">Live Inventory</h2>
                <p className="text-xs text-primary-foreground/70 tracking-widest uppercase">
                  {lots.length} lot{lots.length !== 1 ? "s" : ""} · {stockRows.reduce((s, r) => s + r.qty, 0)} total bars
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-primary-foreground hover:bg-white/20 gap-1"
                onClick={() => refetchLots()}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
            </div>
          </div>

          {/* Manual Register */}
          <div className="border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Select value={registerSize} onValueChange={setRegisterSize}>
                <SelectTrigger className="w-24 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {barCodeOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={registerLength} onChange={(e) => setRegisterLength(e.target.value)} className="w-28 bg-card" placeholder="Length mm" />
              <Input value={registerQty} onChange={(e) => setRegisterQty(e.target.value)} className="w-20 bg-card" placeholder="Qty" type="number" />
              <Button onClick={handleManualRegister} disabled={registering || !registerQty} className="gap-1">
                {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Register
              </Button>
            </div>
          </div>

          {/* Raw Stock */}
          {lotsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : rawStock.length === 0 ? (
            <EmptyState icon={Package} message="No raw stock in inventory" detail="Create a Purchase Order and receive it, or manually register stock above." />
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-black italic text-foreground uppercase">Raw Stock</span>
              </div>
              <div className="grid grid-cols-5 gap-0 px-5 py-2 bg-muted/30 text-[10px] font-bold tracking-widest text-muted-foreground uppercase border-b border-border">
                <span>Source</span>
                <span>Size</span>
                <span>Length</span>
                <span>On Hand</span>
                <span>Reserved</span>
              </div>
              {rawStock.map((row, i) => (
                <div key={i} className="grid grid-cols-5 gap-0 px-5 py-3 border-b border-border/50 items-center">
                  <Badge className="bg-primary/20 text-primary text-[9px] w-fit uppercase">{row.source}</Badge>
                  <span className="text-lg font-black italic text-foreground">{row.bar_code}</span>
                  <span className="text-xs text-muted-foreground">{row.length}mm</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black italic text-foreground">{row.qty}</span>
                    <span className="text-[10px] text-muted-foreground tracking-widest uppercase">bars</span>
                  </div>
                  <span className={`text-sm font-bold ${row.reserved > 0 ? "text-orange-500" : "text-muted-foreground"}`}>
                    {row.reserved > 0 ? row.reserved : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Offcut Bank */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <span className="text-orange-500">✂</span>
              <span className="text-sm font-black italic text-foreground uppercase">Physical Offcut Bank</span>
            </div>
            {remnants.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground tracking-widest uppercase">
                Offcut bank empty — remnants appear after cutting
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-0 px-5 py-2 bg-muted/30 text-[10px] font-bold tracking-widest text-muted-foreground uppercase border-b border-border">
                  <span>Size</span>
                  <span>Remnant Length</span>
                  <span>QTY</span>
                  <span>Available</span>
                </div>
                {remnants.map((row, i) => (
                  <div key={i} className="grid grid-cols-4 gap-0 px-5 py-3 border-b border-border/50 items-center">
                    <span className="text-lg font-black italic text-foreground">{row.bar_code}</span>
                    <span className="text-xs text-muted-foreground">{row.length}mm</span>
                    <span className="text-lg font-bold text-foreground">{row.qty}</span>
                    <span className="text-sm text-emerald-500 font-bold">{row.qty - row.reserved}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </TabsContent>

        {/* ═══ PO Intake Tab ═══ */}
        <TabsContent value="po-intake" className="space-y-4">
          <div className="rounded-xl bg-primary p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-black italic text-primary-foreground uppercase">Purchase Orders</h2>
                <p className="text-xs text-primary-foreground/70 tracking-widest uppercase">
                  {pos.length} order{pos.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="bg-white/10 border-white/20 text-primary-foreground hover:bg-white/20 gap-2"
              onClick={() => setShowCreatePO(true)}
            >
              <Plus className="w-4 h-4" /> New PO
            </Button>
          </div>

          {posLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : pos.length === 0 ? (
            <EmptyState icon={FileText} message="No purchase orders" detail="Create a PO to start ordering stock from your suppliers." />
          ) : (
            <div className="space-y-2">
              {pos.map((po) => (
                <div key={po.id} className="border border-border rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-bold text-sm">{po.po_number}</p>
                      <p className="text-xs text-muted-foreground">{po.supplier_name}</p>
                    </div>
                    <POStatusBadge status={po.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    {po.status !== "received" && po.status !== "canceled" && (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { setReceivingPoId(po.id); setTab("receiving"); }}>
                        <Truck className="w-3.5 h-3.5" /> Receive
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(po.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ Receiving Tab ═══ */}
        <TabsContent value="receiving" className="space-y-4">
          <div className="rounded-xl bg-emerald-600 p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black italic text-white uppercase">Receiving Dock</h2>
                <p className="text-xs text-white/70 tracking-widest uppercase">
                  {receivingPoId ? "Receiving PO" : "Select a PO to receive"}
                </p>
              </div>
            </div>
          </div>

          {!receivingPoId ? (
            <EmptyState icon={Truck} message="No PO selected for receiving" detail="Go to PO Intake and click 'Receive' on a purchase order." />
          ) : (
            <div className="space-y-4">
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-bold text-foreground">Lines to Receive</span>
                </div>
                <div className="grid grid-cols-5 gap-0 px-5 py-2 bg-muted/30 text-[10px] font-bold tracking-widest text-muted-foreground uppercase border-b border-border">
                  <span>Bar Code</span>
                  <span>Length</span>
                  <span>Ordered</span>
                  <span>Already Received</span>
                  <span>Remaining</span>
                </div>
                {receivingLines.map((line) => (
                  <div key={line.id} className="grid grid-cols-5 gap-0 px-5 py-3 border-b border-border/50 items-center">
                    <span className="text-lg font-black italic text-foreground">{line.bar_code}</span>
                    <span className="text-xs text-muted-foreground">{line.standard_length_mm}mm</span>
                    <span className="text-sm font-bold">{line.qty_ordered}</span>
                    <span className="text-sm text-emerald-500 font-bold">{line.qty_received}</span>
                    <span className={`text-lg font-black ${line.qty_ordered - line.qty_received > 0 ? "text-orange-500" : "text-emerald-500"}`}>
                      {line.qty_ordered - line.qty_received}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button size="lg" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleReceive} disabled={receiving}>
                  {receiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Receive All Remaining
                </Button>
                <Button size="lg" variant="outline" onClick={() => setReceivingPoId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ Create PO Dialog ═══ */}
      <Dialog open={showCreatePO} onOpenChange={setShowCreatePO}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>PO Number *</Label>
                <Input value={newPoNumber} onChange={(e) => setNewPoNumber(e.target.value)} placeholder="PO-2026-001" />
              </div>
              <div className="space-y-1.5">
                <Label>Supplier *</Label>
                <Input value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} placeholder="Steel Co." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Expected Delivery</Label>
              <Input type="date" value={newExpectedDate} onChange={(e) => setNewExpectedDate(e.target.value)} />
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Line Items</Label>
                <Button size="sm" variant="outline" onClick={addNewLine} className="gap-1">
                  <Plus className="w-3 h-3" /> Add Line
                </Button>
              </div>
              {newLines.map((line, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 mb-2 items-end">
                  <div>
                    <Label className="text-[10px]">Bar Code</Label>
                    <Select
                      value={line.bar_code}
                      onValueChange={(v) => {
                        const updated = [...newLines];
                        updated[i].bar_code = v;
                        setNewLines(updated);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {barCodeOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Length</Label>
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      value={line.length}
                      onChange={(e) => {
                        const updated = [...newLines];
                        updated[i].length = parseInt(e.target.value) || 12000;
                        setNewLines(updated);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Qty</Label>
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      value={line.qty}
                      onChange={(e) => {
                        const updated = [...newLines];
                        updated[i].qty = parseInt(e.target.value) || 0;
                        setNewLines(updated);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">$/bar</Label>
                    <Input
                      className="h-8 text-xs"
                      value={line.cost}
                      onChange={(e) => {
                        const updated = [...newLines];
                        updated[i].cost = e.target.value;
                        setNewLines(updated);
                      }}
                      placeholder="—"
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setNewLines(newLines.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {newLines.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No lines yet — click "Add Line" above</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePO(false)}>Cancel</Button>
            <Button onClick={handleCreatePO} disabled={creatingPO || !newPoNumber || !newSupplier || !newLines.length}>
              {creatingPO && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────── sub-components ───────── */

function POStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
    submitted: { label: "Submitted", className: "bg-blue-500/20 text-blue-500" },
    partial: { label: "Partial", className: "bg-orange-500/20 text-orange-500" },
    received: { label: "Received", className: "bg-emerald-500/20 text-emerald-500" },
    canceled: { label: "Canceled", className: "bg-destructive/20 text-destructive" },
  };
  const cfg = map[status] || map.draft;
  return <Badge className={`${cfg.className} text-[9px] uppercase tracking-widest border-0`}>{cfg.label}</Badge>;
}

function EmptyState({ icon: Icon, message, detail }: { icon: React.ElementType; message: string; detail: string }) {
  return (
    <div className="border border-dashed border-border rounded-xl p-8 text-center">
      <Icon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-sm font-semibold text-foreground">{message}</p>
      <p className="text-xs text-muted-foreground mt-1">{detail}</p>
    </div>
  );
}
