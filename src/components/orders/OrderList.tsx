import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, FileText, DollarSign } from "lucide-react";
import type { Order } from "@/hooks/useOrders";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-300",
  confirmed: "bg-blue-500/10 text-blue-600 border-blue-300",
  in_production: "bg-violet-500/10 text-violet-600 border-violet-300",
  invoiced: "bg-emerald-500/10 text-emerald-600 border-emerald-300",
  partially_paid: "bg-cyan-500/10 text-cyan-600 border-cyan-300",
  paid: "bg-green-500/10 text-green-700 border-green-300",
  closed: "bg-zinc-500/10 text-zinc-500 border-zinc-300",
  cancelled: "bg-red-500/10 text-red-500 border-red-300",
};

interface Props {
  orders: Order[];
  isLoading: boolean;
  onSelect: (order: Order) => void;
  selectedId?: string;
}

export function OrderList({ orders, isLoading, onSelect, selectedId }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = orders.filter((o) => {
    const matchSearch =
      !search ||
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.customers?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalValue = filtered.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const zeroOrders = filtered.filter((o) => !o.total_amount || o.total_amount === 0).length;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex gap-3 flex-wrap">
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-3 flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{filtered.length}</p>
              <p className="text-xs text-muted-foreground">Orders</p>
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
        {zeroOrders > 0 && (
          <Card className="flex-1 min-w-[140px] border-destructive/30">
            <CardContent className="p-3 flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{zeroOrders}</p>
                <p className="text-xs text-muted-foreground">$0 Orders</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filters */}
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
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="in_production">In Production</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Order list */}
      <ScrollArea className="h-[calc(100vh-380px)]">
        <div className="space-y-1.5">
          {filtered.map((order) => (
            <Card
              key={order.id}
              className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/20 ${selectedId === order.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => onSelect(order)}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {order.order_number}
                    <span className="font-normal text-muted-foreground ml-2">
                      {order.customers?.name || "No customer"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.order_date ? new Date(order.order_date).toLocaleDateString() : "No date"}
                    {order.quotes && <span className="ml-2">← {order.quotes.quote_number}</span>}
                    {order.quickbooks_invoice_id && (
                      <span className="ml-2 text-emerald-600">QB #{order.quickbooks_invoice_id}</span>
                    )}
                  </p>
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
