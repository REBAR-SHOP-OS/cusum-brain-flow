import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
}

export function useSupabaseWorkOrders() {
  const [data, setData] = useState<SupabaseWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data: workOrders, error: err } = await supabase
        .from("work_orders")
        .select("*, orders(order_number, customers(name))")
        .order("priority", { ascending: false })
        .order("scheduled_start", { ascending: true })
        .limit(100);

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
      }));

      setData(mapped);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to fetch work orders"));
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = useCallback(async (workOrderId: string, newStatus: string): Promise<boolean> => {
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === "in_progress" && !data.find(wo => wo.id === workOrderId)?.actual_start) {
      updates.actual_start = new Date().toISOString();
    }
    if (newStatus === "completed") {
      updates.actual_end = new Date().toISOString();
    }

    const { error: err } = await supabase
      .from("work_orders")
      .update(updates)
      .eq("id", workOrderId);

    if (err) return false;
    await fetch();
    return true;
  }, [data]);

  useEffect(() => { fetch(); }, []);

  return { data, loading, error, refetch: fetch, updateStatus };
}
