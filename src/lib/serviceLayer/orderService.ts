/**
 * Order service layer — read-only wrappers around Supabase queries for orders.
 * Purely additive. No existing code calls this yet.
 */
import { supabase } from "@/integrations/supabase/client";

export interface OrderListOptions {
  companyId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function listOrders(options: OrderListOptions) {
  let query = (supabase as any)
    .from("orders")
    .select("*", { count: "exact" })
    .eq("company_id", options.companyId)
    .order("created_at", { ascending: false });

  if (options.status) {
    query = query.eq("status", options.status);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }
  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to list orders: ${error.message}`);
  return { orders: data ?? [], total: count ?? 0 };
}

export async function getOrderById(orderId: string) {
  const { data, error } = await (supabase as any)
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get order: ${error.message}`);
  return data;
}
