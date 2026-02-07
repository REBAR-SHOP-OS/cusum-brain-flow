import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useRebarSizes } from "@/hooks/useCutPlans";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Package, ShoppingCart, FileText, Warehouse, Plus, Trash2, Upload } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Simple mock inventory since no inventory table exists yet
const mockInventory = [
  { id: "1", ident: "RAW_POOL", size: "10MM", length: "12000MM", qty: 360 },
  { id: "2", ident: "RAW_POOL", size: "10MM", length: "6000MM", qty: 384 },
  { id: "3", ident: "RAW_POOL", size: "15MM", length: "12000MM", qty: 835 },
  { id: "4", ident: "RAW_POOL", size: "15MM", length: "6000MM", qty: 265 },
  { id: "5", ident: "RAW_POOL", size: "20MM", length: "12000MM", qty: 27 },
  { id: "6", ident: "RAW_POOL", size: "20MM", length: "6000MM", qty: 65 },
  { id: "7", ident: "RAW_POOL", size: "25MM", length: "12000MM", qty: 106 },
  { id: "8", ident: "RAW_POOL", size: "25MM", length: "6000MM", qty: 7 },
  { id: "9", ident: "RAW_POOL", size: "30MM", length: "12000MM", qty: 24 },
  { id: "10", ident: "RAW_POOL", size: "35MM", length: "12000MM", qty: 20 },
];

const mockProcurement = [
  { size: "10M", standard: "12000MM", required: 10, onHand: 0, netToOrder: 10, kg: 94.28 },
  { size: "15M", standard: "12000MM", required: 63, onHand: 0, netToOrder: 63, kg: 593.46 },
  { size: "20M", standard: "12000MM", required: 38, onHand: 0, netToOrder: 38, kg: 357.96 },
];

export function InventoryView() {
  const [tab, setTab] = useState("procurement");
  const rebarSizes = useRebarSizes();
  const [registerSize, setRegisterSize] = useState("10MM");
  const [registerLength, setRegisterLength] = useState("12000");
  const [registerQty, setRegisterQty] = useState("");

  const totalKg = mockProcurement.reduce((sum, r) => sum + r.kg, 0);

  return (
    <div className="p-6 space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-center mb-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="procurement" className="gap-1.5 text-xs">
              <ShoppingCart className="w-3.5 h-3.5" /> Procurement
            </TabsTrigger>
            <TabsTrigger value="po-intake" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" /> PO_Intake
            </TabsTrigger>
            <TabsTrigger value="warehouse" className="gap-1.5 text-xs">
              <Warehouse className="w-3.5 h-3.5" /> Warehouse
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Procurement Tab */}
        <TabsContent value="procurement" className="space-y-4">
          <div className="rounded-xl bg-primary p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-black italic text-primary-foreground uppercase">Material Procurement</h2>
                <p className="text-xs text-primary-foreground/70 tracking-widest uppercase">Project Tonnage Requirements</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-primary-foreground/70 tracking-widest uppercase">Total Weight Requisition</p>
              <p className="text-2xl font-black text-primary-foreground">{totalKg.toFixed(2)} KG</p>
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-6 gap-0 px-5 py-3 bg-muted/50 text-[10px] font-bold tracking-widest text-muted-foreground uppercase border-b border-border">
              <span>Rebar Size</span>
              <span>Stock Standard</span>
              <span>Required (Bars)</span>
              <span>Warehouse on Hand</span>
              <span className="text-primary">Net to Order</span>
              <span>KG</span>
            </div>
            {mockProcurement.map((row, i) => (
              <div key={i} className="grid grid-cols-6 gap-0 px-5 py-4 border-b border-border/50 items-center">
                <span className="text-lg font-black italic text-foreground">{row.size}</span>
                <span className="text-xs text-muted-foreground">{row.standard}</span>
                <span className="text-lg font-bold text-foreground">{row.required}</span>
                <div className="w-16 h-8 bg-muted rounded" />
                <span className="text-lg font-bold text-primary">{row.netToOrder}</span>
                <span className="text-xs text-muted-foreground">{row.kg}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* PO Intake Tab */}
        <TabsContent value="po-intake" className="space-y-4">
          <div className="rounded-xl bg-primary p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-black italic text-primary-foreground uppercase">PO Receiving Dock</h2>
                <p className="text-xs text-primary-foreground/70 tracking-widest uppercase">AI Vision Automated Intake System</p>
              </div>
            </div>
            <Button variant="outline" className="bg-white/10 border-white/20 text-primary-foreground hover:bg-white/20 gap-2">
              <Upload className="w-4 h-4" /> Upload Purchase Order
            </Button>
          </div>

          <div className="border border-border rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-4 gap-4 items-end">
              <div>
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">Rebar Size</label>
                <Select value={registerSize} onValueChange={setRegisterSize}>
                  <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["10MM", "15MM", "20MM", "25MM", "30MM", "35MM"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">Bar Length (MM)</label>
                <Input value={registerLength} onChange={(e) => setRegisterLength(e.target.value)} className="bg-card" />
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">Quantity</label>
                <Input value={registerQty} onChange={(e) => setRegisterQty(e.target.value)} className="bg-card" placeholder="" />
              </div>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Add Line
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Warehouse Tab */}
        <TabsContent value="warehouse" className="space-y-4">
          <div className="rounded-xl bg-primary p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-black italic text-primary-foreground uppercase">Inventory Pulse</h2>
                <p className="text-xs text-primary-foreground/70 tracking-widest uppercase">Manual Register & Adjustments</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={registerSize} onValueChange={setRegisterSize}>
                <SelectTrigger className="w-24 bg-white/10 border-white/20 text-primary-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["10MM", "15MM", "20MM", "25MM", "30MM", "35MM"].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={registerLength} onChange={(e) => setRegisterLength(e.target.value)} className="w-24 bg-white/10 border-white/20 text-primary-foreground" />
              <Input value={registerQty} onChange={(e) => setRegisterQty(e.target.value)} className="w-20 bg-white/10 border-white/20 text-primary-foreground" placeholder="" />
              <Button variant="outline" className="bg-white/10 border-white/20 text-primary-foreground hover:bg-white/20 gap-2">
                <Plus className="w-4 h-4" /> Register
              </Button>
            </div>
          </div>

          {/* Raw Stock Reservoir */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-black italic text-foreground uppercase">Raw Stock Reservoir</span>
            </div>
            <div className="grid grid-cols-5 gap-0 px-5 py-2 bg-muted/30 text-[10px] font-bold tracking-widest text-muted-foreground uppercase border-b border-border">
              <span>Ident</span>
              <span>Size</span>
              <span>Standard Length</span>
              <span>QTY</span>
              <span>Actions</span>
            </div>
            {mockInventory.map((row) => (
              <div key={row.id} className="grid grid-cols-5 gap-0 px-5 py-3 border-b border-border/50 items-center">
                <Badge className="bg-primary/20 text-primary text-[9px] w-fit">{row.ident}</Badge>
                <span className="text-lg font-black italic text-foreground">{row.size}</span>
                <span className="text-xs text-muted-foreground">{row.length}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black italic text-foreground">{row.qty}</span>
                  <span className="text-[10px] text-muted-foreground tracking-widest uppercase">bars</span>
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Physical Offcut Bank */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <span className="text-orange-500">✂</span>
              <span className="text-sm font-black italic text-foreground uppercase">Physical Offcut Bank</span>
            </div>
            <div className="grid grid-cols-5 gap-0 px-5 py-2 bg-muted/30 text-[10px] font-bold tracking-widest text-muted-foreground uppercase border-b border-border">
              <span>Bucket</span>
              <span>Size</span>
              <span>Remnant Length</span>
              <span>QTY</span>
              <span>Actions</span>
            </div>
            <div className="p-8 text-center text-sm text-muted-foreground tracking-widest uppercase">
              Offcut bank empty
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
