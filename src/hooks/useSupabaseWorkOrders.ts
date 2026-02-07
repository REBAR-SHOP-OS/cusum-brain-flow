import { useEffect, useState } from "react";
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
        .select("*")
        .order("priority", { ascending: false })
        .order("scheduled_start", { ascending: true })
        .limit(100);

      if (err) throw new Error(err.message);
      setData(workOrders || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to fetch work orders"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  return { data, loading, error, refetch: fetch };
}
