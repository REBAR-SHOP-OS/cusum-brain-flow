/**
 * Production service layer — read-only wrappers for production/work order queries.
 * Purely additive. No existing code calls this yet.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ServiceResult } from "./types";

export interface ProductionListOptions {
  companyId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function listProductionTasks(options: ProductionListOptions): Promise<ServiceResult<{ tasks: any[]; total: number }>> {
  try {
    let query = (supabase as any)
      .from("work_orders")
      .select("*", { count: "exact" })
      .eq("company_id", options.companyId)
      .order("created_at", { ascending: false });

    if (options.status) query = query.eq("status", options.status);
    if (options.limit) query = query.limit(options.limit);
    if (options.offset) query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1);

    const { data, error, count } = await query;
    if (error) return { ok: false, data: { tasks: [], total: 0 }, error: error.message };
    return { ok: true, data: { tasks: data ?? [], total: count ?? 0 } };
  } catch (err: any) {
    return { ok: false, data: { tasks: [], total: 0 }, error: err.message };
  }
}

export async function getProductionTaskById(taskId: string): Promise<ServiceResult<any>> {
  try {
    const { data, error } = await (supabase as any)
      .from("work_orders")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    if (error) return { ok: false, data: null, error: error.message };
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, data: null, error: err.message };
  }
}
