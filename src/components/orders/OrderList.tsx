import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, DollarSign, Circle } from "lucide-react";
import type { Order } from "@/hooks/useOrders";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const STATUS_COLORS: Record<string, string> = {
  // Extract / Pre-commercial
  extract_new:         "bg-amber-500/10 text-amber-600 border-amber-300",
  needs_customer:      "bg-orange-500/10 text-orange-600 border-orange-300",
  needs_scope_confirm: "bg-amber-500/10 text-amber-700 border-amber-400",
  needs_pricing:       "bg-yellow-500/10 text-yellow-700 border-yellow-400",
  quote_ready:         "bg-sky-500/10 text-sky-600 border-sky-300",
  quote_sent:          "bg-blue-500/10 text-blue-600 border-blue-300",
  won:                 "bg-green-500/10 text-green-600 border-green-300",
  lost:                "bg-red-500/10 text-red-500 border-red-300",
  archived:            "bg-zinc-500/10 text-zinc-500 border-zinc-300",
  // Commercial / Ops
  approved:            "bg-emerald-500/10 text-emerald-600 border-emerald-300",
  queued_production:   "bg-violet-500/10 text-violet-600 border-violet-300",
  in_production:       "bg-purple-500/10 text-purple-600 border-purple-300",
  ready:               "bg-teal-500/10 text-teal-600 border-teal-300",
  delivery_staged:     "bg-indigo-500/10 text-indigo-600 border-indigo-300",
  ready_for_pickup:    "bg-cyan-500/10 text-cyan-600 border-cyan-300",
  delivered:           "bg-green-500/10 text-green-700 border-green-400",
  invoiced:            "bg-emerald-500/10 text-emerald-700 border-emerald-400",
  partially_paid:      "bg-cyan-500/10 text-cyan-700 border-cyan-400",
  paid:                "bg-green-600/10 text-green-800 border-green-500",
  closed:              "bg-zinc-500/10 text-zinc-500 border-zinc-300",
  cancelled:           "bg-red-500/10 text-red-500 border-red-300",
  // Legacy
  pending:             "bg-amber-500/10 text-amber-600 border-amber-300",
  confirmed:           "bg-blue-500/10 text-blue-600 border-blue-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-zinc-400",
  medium: "text-amber-500",
  high: "text-red-500",
};

const KIND_TABS = [
  { value: "all", label: "All" },
  { value: "extract", label: "Extracts" },
  { value: "commercial", label: "Commercial" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  // Extract
  { value: "extract_new", label: "Extract New" },
  { value: "needs_customer", label: "Needs Customer" },
  { value: "needs_pricing", label: "Needs Pricing" },
  { value: "quote_ready", label: "Quote Ready" },
  { value: "quote_sent", label: "Quote Sent" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  // Commercial
  { value: "approved", label: "Approved" },
  { value: "queued_production", label: "Queued" },
  { value: "in_production", label: "In Production" },
  { value: "ready", label: "Ready" },
  { value: "delivery_staged", label: "Delivery Staged" },
  { value: "ready_for_pickup", label: "Ready for Pickup" },
  { value: "delivered", label: "Delivered" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
  // Legacy
  { value: "pending", label: "Pending (legacy)" },
  { value: "confirmed", label: "Confirmed (legacy)" },
];

interface Props {
  orders: Order[];
  isLoading: boolean;
  onSelect: (order: Order) => void;
  selectedId?: string;
}

export function OrderList({ orders, isLoading, onSelect, selectedId }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");

  const filtered = orders.filter((o) => {
    const matchSearch =
      !search ||
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.customers?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchKind = kindFilter === "all" || o.order_kind === kindFilter;
    return matchSearch && matchStatus && matchKind;
  });

  const totalValue = filtered.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const extractCount = filtered.filter((o) => o.order_kind === "extract").length;
  const commercialCount = filtered.filter((o) => o.order_kind === "commercial").length;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex gap-3 flex-wrap">
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-3 flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{filtered.length}</p>
              <p className="text-xs text-muted-foreground">
                {extractCount > 0 && <span className="text-amber-600">{extractCount} extract</span>}
                {extractCount > 0 && commercialCount > 0 && " · "}
                {commercialCount > 0 && <span className="text-emerald-600">{commercialCount} commercial</span>}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-3 flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold">{fmt(totalValue)}</p>
              <p className="text-xs text-muted-foreground">Total Value</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kind filter tabs */}
      <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-muted/30">
        {KIND_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setKindFilter(tab.value)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
              kindFilter === tab.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Status filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Order list */}
      <ScrollArea className="h-[calc(100vh-420px)]">
        <div className="space-y-1.5">
          {filtered.map((order) => (
            <Card
              key={order.id}
              className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/20 ${selectedId === order.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => onSelect(order)}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div className="min-w-0 flex items-center gap-2">
                  <Circle className={`w-2.5 h-2.5 fill-current shrink-0 ${PRIORITY_COLORS[order.priority] || PRIORITY_COLORS.medium}`} />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {order.order_number}
                      <span className="font-normal text-muted-foreground ml-2">
                        {order.customers?.name || "No customer"}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 mr-1.5 font-normal">
                        {order.order_kind === "extract" ? "EXT" : "COM"}
                      </Badge>
                      {order.order_date ? new Date(order.order_date).toLocaleDateString() : "No date"}
                      {order.quotes && <span className="ml-2">← {order.quotes.quote_number}</span>}
                      {order.quickbooks_invoice_id && (
                        <span className="ml-2 text-emerald-600">QB #{order.quickbooks_invoice_id}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-sm font-semibold ${(!order.total_amount || order.total_amount === 0) ? "text-destructive" : ""}`}>
                    {fmt(order.total_amount || 0)}
                  </span>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[order.status || "pending"] || ""}`}>
                    {(order.status || "pending").replace(/_/g, " ")}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No orders found</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
