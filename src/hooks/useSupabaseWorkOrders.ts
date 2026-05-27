import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";
import { startWorkOrder as dispatchStart, pauseWorkOrder as dispatchPause } from "@/lib/workOrderDispatch";

export interface SupabaseWorkOrder {
  id: string;
  work_order_number: string;
  status: string | null;
  workstation: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  priority: number | null;
  notes: string | null;
  assigned_to: string | null;
  order_id: string;
  customer_name: string | null;
  order_number: string | null;
  created_at: string | null;
}

async function fetchWorkOrders(): Promise<SupabaseWorkOrder[]> {
  const { data: workOrders, error: err } = await supabase
    .from("work_orders")
    .select("*, orders(order_number, customers(name))")
    .in("status", ["pending", "queued", "in_progress", "on_hold"])
    .order("created_at", { ascending: false })
    .limit(500);

  if (err) throw new Error(err.message);

  const mapped: SupabaseWorkOrder[] = (workOrders || []).map((wo: any) => ({
    id: wo.id,
    work_order_number: wo.work_order_number,
    status: wo.status,
    workstation: wo.workstation,
    scheduled_start: wo.scheduled_start,
    scheduled_end: wo.scheduled_end,
    actual_start: wo.actual_start,
    actual_end: wo.actual_end,
    priority: wo.priority,
    notes: wo.notes,
    assigned_to: wo.assigned_to,
    order_id: wo.order_id,
    customer_name: wo.orders?.customers?.name || null,
    order_number: wo.orders?.order_number || null,
    created_at: wo.created_at || null,
  }));

  // Filter out WOs with no remaining cuttable items (phase queued/cutting).
  // WOs whose items are all past cutting belong to clearance/loading/pickup, not the cutter Start queue.
  const woIds = mapped.map(wo => wo.id);
  if (woIds.length > 0) {
    const { data: cuttable } = await supabase
      .from("cut_plan_items")
      .select("work_order_id, phase")
      .in("work_order_id", woIds);

    const idsWithCuttable = new Set(
      (cuttable || [])
        .filter((r: any) => ["queued", "cutting"].includes(String(r.phase || "").toLowerCase()))
        .map((r: any) => r.work_order_id)
    );
    return mapped.filter(wo =>
      idsWithCuttable.has(wo.id) || wo.status === "in_progress" || wo.status === "on_hold"
    );
  }
  return mapped;
}

export function useSupabaseWorkOrders() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["work-orders"],
    queryFn: fetchWorkOrders,
  });

  const updateStatus = useCallback(async (workOrderId: string, newStatus: string): Promise<boolean> => {
    const previous = queryClient.getQueryData<SupabaseWorkOrder[]>(["work-orders"]);
    const wo = previous?.find(w => w.id === workOrderId);

    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === "in_progress" && !wo?.actual_start) {
      updates.actual_start = new Date().toISOString();
    }
    if (newStatus === "completed") {
      updates.actual_end = new Date().toISOString();
    }

    // Optimistic update — reflect change immediately in UI
    if (previous) {
      queryClient.setQueryData<SupabaseWorkOrder[]>(["work-orders"], prev =>
        (prev || []).map(w => w.id === workOrderId ? { ...w, ...updates } : w)
      );
    }

    const { data: returned, error: err } = await supabase
      .from("work_orders")
      .update(updates)
      .eq("id", workOrderId)
      .select("id");

    if (err || !returned || returned.length === 0) {
      // Rollback optimistic update
      if (previous) queryClient.setQueryData(["work-orders"], previous);
      console.error("Failed to update work order status:", err?.message || "No rows affected (RLS?)");
      return false;
    }

    // Invalidate all related caches so sibling components refresh
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["work-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["cut-plans"] }),
      queryClient.invalidateQueries({ queryKey: ["station-data"] }),
      queryClient.invalidateQueries({ queryKey: ["production-queues"] }),
    ]);

    return true;
  }, [queryClient]);

  const invalidateAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["work-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["cut-plans"] }),
      queryClient.invalidateQueries({ queryKey: ["station-data"] }),
      queryClient.invalidateQueries({ queryKey: ["production-queues"] }),
    ]);
  }, [queryClient]);

  const startWorkOrder = useCallback(async (workOrderId: string) => {
    const result = await dispatchStart(workOrderId);
    if (result.ok) {
      await updateStatus(workOrderId, "in_progress");
    }
    await invalidateAll();
    return result;
  }, [updateStatus, invalidateAll]);

  const pauseWorkOrder = useCallback(async (workOrderId: string) => {
    const result = await dispatchPause(workOrderId);
    await updateStatus(workOrderId, "on_hold");
    await invalidateAll();
    return result;
  }, [updateStatus, invalidateAll]);

  return {
    data: data ?? [],
    loading: isLoading,
    error: error ?? null,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["work-orders"] }),
    updateStatus,
    startWorkOrder,
    pauseWorkOrder,
  };
}
