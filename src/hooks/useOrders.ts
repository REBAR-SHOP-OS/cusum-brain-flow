import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCallback } from "react";

export interface OrderItem {
  id: string;
  order_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  bar_size: string | null;
  length_mm: number | null;
  shape: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  quote_id: string | null;
  company_id: string | null;
  total_amount: number | null;
  status: string | null;
  order_date: string | null;
  required_date: string | null;
  quickbooks_invoice_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  customers?: { id: string; name: string; quickbooks_id: string | null; company_name: string | null } | null;
  quotes?: { id: string; quote_number: string } | null;
}

export function useOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── Orders list ────────────────────────────────────
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(id, name, quickbooks_id, company_name), quotes(id, quote_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  // ─── Order items ────────────────────────────────────
  const useOrderItems = (orderId: string | null) =>
    useQuery({
      queryKey: ["order-items", orderId],
      queryFn: async () => {
        if (!orderId) return [];
        const { data, error } = await supabase
          .from("order_items")
          .select("*")
          .eq("order_id", orderId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return data as OrderItem[];
      },
      enabled: !!orderId,
    });

  // ─── Add item ───────────────────────────────────────
  const addItem = useMutation({
    mutationFn: async (item: { order_id: string; description: string; quantity: number; unit_price: number; bar_size?: string; length_mm?: number; shape?: string; notes?: string }) => {
      const { data, error } = await supabase.from("order_items").insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["order-items", vars.order_id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  // ─── Update item ────────────────────────────────────
  const updateItem = useMutation({
    mutationFn: async ({ id, orderId, ...updates }: { id: string; orderId: string; description?: string; quantity?: number; unit_price?: number; bar_size?: string | null; length_mm?: number | null; shape?: string | null; notes?: string | null }) => {
      const { error } = await supabase.from("order_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["order-items", vars.orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  // ─── Delete item ────────────────────────────────────
  const deleteItem = useMutation({
    mutationFn: async ({ id, orderId }: { id: string; orderId: string }) => {
      const { error } = await supabase.from("order_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["order-items", vars.orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  // ─── Update order status ────────────────────────────
  const updateOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  // ─── Convert quote to order ─────────────────────────
  const convertQuote = useCallback(async (quoteId: string) => {
    const { data, error } = await supabase.functions.invoke("convert-quote-to-order", {
      body: { quoteId },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    toast({
      title: "✅ Order created",
      description: `Order ${data.order.order_number} created with ${data.itemsCreated} line item(s)`,
    });
    return data;
  }, [queryClient, toast]);

  // ─── Send to QuickBooks ─────────────────────────────
  const sendToQuickBooks = useCallback(async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) throw new Error("Order not found");
    if (!order.customers?.quickbooks_id) throw new Error("Customer has no QuickBooks ID — link it first");

    // Fetch items
    const { data: items, error: iErr } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);
    if (iErr) throw iErr;
    if (!items || items.length === 0) throw new Error("Order has no line items");

    const lineItems = items.map((i: OrderItem) => ({
      description: i.description,
      amount: i.unit_price,
      quantity: i.quantity,
    }));

    const { data, error } = await supabase.functions.invoke("quickbooks-oauth", {
      body: {
        action: "create-invoice",
        customerId: order.customers.quickbooks_id,
        customerName: order.customers.name,
        lineItems,
        memo: `Order ${order.order_number}`,
      },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);

    // Update order with QB invoice ID and advance status
    const docNumber = data.docNumber || data.invoice?.DocNumber || null;
    await supabase
      .from("orders")
      .update({
        quickbooks_invoice_id: docNumber,
        status: "invoiced",
      })
      .eq("id", orderId);

    queryClient.invalidateQueries({ queryKey: ["orders"] });
    toast({
      title: "📧 Invoice created in QuickBooks",
      description: `Invoice #${docNumber} created for ${order.customers.name}`,
    });
    return data;
  }, [orders, queryClient, toast]);

  return {
    orders,
    isLoading,
    useOrderItems,
    addItem,
    updateItem,
    deleteItem,
    updateOrderStatus,
    convertQuote,
    sendToQuickBooks,
  };
}
