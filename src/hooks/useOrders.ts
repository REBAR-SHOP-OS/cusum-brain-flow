import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCallback } from "react";
import { useCompanyId } from "@/hooks/useCompanyId";

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
  // Shop drawing & QC fields
  shop_drawing_status: string;
  customer_revision_count: number;
  billable_revision_required: boolean;
  qc_internal_approved_at: string | null;
  customer_approved_at: string | null;
  production_locked: boolean;
  pending_change_order: boolean;
  qc_final_approved: boolean;
  qc_evidence_uploaded: boolean;
  // Lifecycle fields (Phase 1)
  order_kind: string;
  owner_id: string | null;
  priority: string;
  delivery_method: string;
  expected_value: number | null;
  production_override: boolean;
  due_date: string | null;
  // joined
  customers?: { id: string; name: string; quickbooks_id: string | null; company_name: string | null } | null;
  quotes?: { id: string; quote_number: string } | null;
}

// ─── 16-stage status ladder ────────────────────────────
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  // Extract / Pre-commercial
  extract_new:        ["needs_customer", "needs_pricing", "cancelled"],
  needs_customer:     ["needs_scope_confirm", "needs_pricing", "cancelled"],
  needs_scope_confirm:["needs_pricing", "cancelled"],
  needs_pricing:      ["quote_ready", "cancelled"],
  quote_ready:        ["quote_sent", "cancelled"],
  quote_sent:         ["won", "lost", "archived"],
  won:                ["approved"],
  lost:               [],
  archived:           [],
  // Commercial / Ops
  approved:           ["queued_production", "cancelled"],
  queued_production:   ["in_production", "cancelled"],
  in_production:      ["ready", "cancelled"],
  ready:              ["delivery_staged", "ready_for_pickup", "cancelled"],
  delivery_staged:    ["delivered", "cancelled"],
  ready_for_pickup:   ["delivered", "cancelled"],
  delivered:          ["invoiced"],
  invoiced:           ["partially_paid", "paid"],
  partially_paid:     ["paid"],
  paid:               ["closed"],
  closed:             [],
  cancelled:          [],
  // Legacy compat
  pending:            ["confirmed", "needs_customer", "needs_pricing", "approved", "cancelled"],
  confirmed:          ["in_production", "approved", "cancelled"],
};

export const ORDER_KIND_LABELS: Record<string, string> = {
  extract: "Extract",
  commercial: "Commercial",
};

export const PRIORITY_OPTIONS = ["low", "medium", "high"] as const;
export const DELIVERY_METHOD_OPTIONS = ["pickup", "delivery"] as const;

export function useOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();

  // ─── Orders list ────────────────────────────────────
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(id, name, quickbooks_id, company_name), quotes(id, quote_number)")
        .eq("company_id", companyId!)
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
    mutationFn: async ({ id, status, currentStatus }: { id: string; status: string; currentStatus?: string }) => {
      if (currentStatus && ALLOWED_TRANSITIONS[currentStatus]) {
        if (!ALLOWED_TRANSITIONS[currentStatus].includes(status)) {
          throw new Error(`Invalid transition: ${currentStatus} → ${status}. Allowed: ${ALLOWED_TRANSITIONS[currentStatus].join(", ")}`);
        }
      }
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => {
      toast({ title: "Status update failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    },
  });

  // ─── Update order fields (QC, shop drawing, lifecycle, etc.) ──
  const updateOrderFields = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; [key: string]: unknown }) => {
      const { error } = await supabase.from("orders").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
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
    if (order.quickbooks_invoice_id) {
      throw new Error(`Order already invoiced (Invoice #${order.quickbooks_invoice_id})`);
    }
    if (!["approved", "queued_production", "in_production", "confirmed"].includes(order.status || "")) {
      throw new Error(`Cannot invoice: order is "${order.status}", must be "approved" or "in_production" first`);
    }
    if (!order.customers?.quickbooks_id) throw new Error("Customer has no QuickBooks ID — link it first");

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
        companyId,
        orderId,
        customerId: order.customers.quickbooks_id,
        customerName: order.customers.name,
        lineItems,
        memo: `Order ${order.order_number}`,
      },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);

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
  }, [orders, queryClient, toast, companyId]);

  return {
    orders,
    isLoading,
    useOrderItems,
    addItem,
    updateItem,
    deleteItem,
    updateOrderStatus,
    updateOrderFields,
    convertQuote,
    sendToQuickBooks,
  };
}
