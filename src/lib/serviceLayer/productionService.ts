/**
 * Production service layer — read-only wrappers for production/work order queries.
 * Purely additive. No existing code calls this yet.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ProductionListOptions {
  companyId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function listProductionTasks(options: ProductionListOptions) {
  let query = (supabase as any)
    .from("work_orders")
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
  if (error) throw new Error(`Failed to list production tasks: ${error.message}`);
  return { tasks: data ?? [], total: count ?? 0 };
}

export async function getProductionTaskById(taskId: string) {
  const { data, error } = await (supabase as any)
    .from("work_orders")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get production task: ${error.message}`);
  return data;
}
