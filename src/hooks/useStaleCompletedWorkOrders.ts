import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Surfaces work orders flagged `completed` whose underlying cut_plan_items
 * are NOT actually finished — i.e. the WO header was advanced (manually or
 * by an upstream job) while pieces are still queued/cutting or
 * `completed_pieces < total_pieces`.
 *
 * Without this surface those WOs disappear from the queue, so the manifest
 * silently stalls before the cutter even though the customer-facing status
 * reads "done".
 */
export interface StaleCompletedWorkOrder {
  id: string;
  work_order_number: string;
  customer_name: string | null;
  order_number: string | null;
  barlist_id: string | null;
  project_id: string | null;
  actual_end: string | null;
  pending_pieces: number;
  total_pieces: number;
  unfinished_items: number;
}

const FRESH_WINDOW_DAYS = 60;

async function fetchStaleCompletedWorkOrders(): Promise<StaleCompletedWorkOrder[]> {
  const since = new Date(Date.now() - FRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: wos, error } = await supabase
    .from("work_orders")
    .select(
      "id, work_order_number, status, actual_end, barlist_id, project_id, orders(order_number, customers(name))",
    )
    .eq("status", "completed")
    .gte("created_at", since)
    .order("actual_end", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const rows = (wos || []) as any[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: items, error: iErr } = await supabase
    .from("cut_plan_items")
    .select("work_order_id, phase, total_pieces, completed_pieces")
    .in("work_order_id", ids);
  if (iErr) throw new Error(iErr.message);

  const agg = new Map<string, { pending: number; total: number; unfinished: number }>();
  for (const it of (items || []) as any[]) {
    const woId = it.work_order_id as string | null;
    if (!woId) continue;
    const total = Number(it.total_pieces || 0);
    const done = Number(it.completed_pieces || 0);
    const phase = String(it.phase || "").toLowerCase();
    const isUnfinished = done < total || ["queued", "cutting"].includes(phase);
    const cur = agg.get(woId) || { pending: 0, total: 0, unfinished: 0 };
    cur.total += total;
    cur.pending += Math.max(0, total - done);
    if (isUnfinished) cur.unfinished += 1;
    agg.set(woId, cur);
  }

  return rows
    .map((r) => {
      const a = agg.get(r.id) || { pending: 0, total: 0, unfinished: 0 };
      return {
        id: r.id,
        work_order_number: r.work_order_number,
        customer_name: r.orders?.customers?.name || null,
        order_number: r.orders?.order_number || null,
        barlist_id: r.barlist_id ?? null,
        project_id: r.project_id ?? null,
        actual_end: r.actual_end ?? null,
        pending_pieces: a.pending,
        total_pieces: a.total,
        unfinished_items: a.unfinished,
      } satisfies StaleCompletedWorkOrder;
    })
    .filter((r) => r.unfinished_items > 0 || r.pending_pieces > 0);
}

export function useStaleCompletedWorkOrders() {
  return useQuery({
    queryKey: ["stale-completed-work-orders"],
    queryFn: fetchStaleCompletedWorkOrders,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
