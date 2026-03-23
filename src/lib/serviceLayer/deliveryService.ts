/**
 * Delivery service layer — read-only wrappers for delivery queries.
 * Purely additive. No existing code calls this yet.
 */
import { supabase } from "@/integrations/supabase/client";

export interface DeliveryListOptions {
  companyId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function listDeliveries(options: DeliveryListOptions) {
  let query = (supabase as any)
    .from("deliveries")
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
  if (error) throw new Error(`Failed to list deliveries: ${error.message}`);
  return { deliveries: data ?? [], total: count ?? 0 };
}

export async function getDeliveryById(deliveryId: string) {
  const { data, error } = await (supabase as any)
    .from("deliveries")
    .select("*")
    .eq("id", deliveryId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get delivery: ${error.message}`);
  return data;
}
