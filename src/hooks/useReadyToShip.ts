import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useToast } from "@/hooks/use-toast";

export type FulfillmentChannel = "pickup" | "loading" | "delivery";

export interface ReadyItem {
  id: string;
  cut_plan_id: string;
  bar_code: string | null;
  cut_length_mm: number | null;
  total_pieces: number;
  mark_number: string | null;
  bend_type: string | null;
  fulfillment_channel: FulfillmentChannel;
  ready_at: string | null;
  plan_name: string | null;
  project_name: string | null;
  customer_name: string | null;
}

export function useReadyToShip() {
  const { companyId } = useCompanyId();
  const { toast } = useToast();
  const [items, setItems] = useState<ReadyItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!companyId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("cut_plan_items")
      .select(
        "id, cut_plan_id, bar_code, cut_length_mm, total_pieces, mark_number, bend_type, fulfillment_channel, ready_at, delivery_id, loading_list_id, pickup_id, cut_plans!inner(name, company_id, projects(name, customers(name)))"
      )
      .eq("phase", "complete")
      .is("delivery_id", null)
      .is("loading_list_id", null)
      .is("pickup_id", null)
      .eq("cut_plans.company_id", companyId)
      .order("ready_at", { ascending: false, nullsFirst: false })
      .limit(500);

    if (error) {
      toast({
        title: "Error loading ready-to-ship items",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const mapped: ReadyItem[] = (data || []).map((row: any) => ({
      id: row.id,
      cut_plan_id: row.cut_plan_id,
      bar_code: row.bar_code,
      cut_length_mm: row.cut_length_mm,
      total_pieces: row.total_pieces,
      mark_number: row.mark_number,
      bend_type: row.bend_type,
      fulfillment_channel: (row.fulfillment_channel ?? "pickup") as FulfillmentChannel,
      ready_at: row.ready_at,
      plan_name: row.cut_plans?.name ?? null,
      project_name: row.cut_plans?.projects?.name ?? null,
      customer_name: row.cut_plans?.projects?.customers?.name ?? null,
    }));
    setItems(mapped);
    setLoading(false);
  }, [companyId, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime — unique channel name per workspace memory
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`ready-to-ship-${companyId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cut_plan_items" },
        () => fetchItems()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, fetchItems]);

  const setChannel = useCallback(
    async (itemId: string, channel: FulfillmentChannel) => {
      // Optimistic update
      setItems(prev =>
        prev.map(i => (i.id === itemId ? { ...i, fulfillment_channel: channel } : i))
      );
      const { error } = await supabase
        .from("cut_plan_items")
        .update({ fulfillment_channel: channel })
        .eq("id", itemId);
      if (error) {
        toast({
          title: "Failed to re-route",
          description: error.message,
          variant: "destructive",
        });
        fetchItems();
      } else {
        toast({ title: `Moved to ${channel}` });
      }
    },
    [toast, fetchItems]
  );

  const counts = useMemo(() => {
    const c = { pickup: 0, loading: 0, delivery: 0, total: items.length };
    for (const i of items) c[i.fulfillment_channel]++;
    return c;
  }, [items]);

  return { items, counts, loading, refresh: fetchItems, setChannel };
}
