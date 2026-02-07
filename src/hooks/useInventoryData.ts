import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";

export interface InventoryLot {
  id: string;
  bar_code: string;
  lot_number: string | null;
  source: string;
  standard_length_mm: number;
  qty_on_hand: number;
  qty_reserved: number;
  location: string | null;
}

export interface FloorStockItem {
  id: string;
  bar_code: string;
  length_mm: number;
  qty_on_hand: number;
  qty_reserved: number;
  machine_id: string | null;
}

export interface Reservation {
  id: string;
  cut_plan_id: string | null;
  cut_plan_item_id: string | null;
  source_type: string;
  source_id: string;
  bar_code: string;
  qty_reserved: number;
  qty_consumed: number;
  stock_length_mm: number;
  status: string;
}

export interface ScrapRecord {
  id: string;
  machine_run_id: string | null;
  bar_code: string;
  length_mm: number;
  qty: number;
  reason: string | null;
  created_at: string;
}

export interface CutOutputBatch {
  id: string;
  machine_run_id: string | null;
  bar_code: string;
  cut_length_mm: number;
  qty_produced: number;
  qty_available: number;
  qty_consumed: number;
  status: string;
}

export interface InventorySummary {
  totalReserved: number;
  totalConsumed: number;
  remnantsCreated: number;
  scrapRecorded: number;
  reservationsBySource: Record<string, number>;
}

export function useInventoryData(cutPlanId: string | null, barCode?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Reservations for the current plan
  const { data: reservations = [], isLoading: reservationsLoading } = useQuery({
    queryKey: ["inventory-reservations", cutPlanId],
    enabled: !!user && !!cutPlanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_reservations")
        .select("*")
        .eq("cut_plan_id", cutPlanId!);
      if (error) throw error;
      return (data || []) as Reservation[];
    },
  });

  // Available lots for a bar code
  const { data: lots = [], isLoading: lotsLoading } = useQuery({
    queryKey: ["inventory-lots", barCode],
    enabled: !!user && !!barCode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_lots")
        .select("*")
        .eq("bar_code", barCode!);
      if (error) throw error;
      return (data || []) as InventoryLot[];
    },
  });

  // Floor stock for bar code
  const { data: floorStock = [], isLoading: floorLoading } = useQuery({
    queryKey: ["floor-stock", barCode],
    enabled: !!user && !!barCode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("floor_stock")
        .select("*")
        .eq("bar_code", barCode!);
      if (error) throw error;
      return (data || []) as FloorStockItem[];
    },
  });

  // Scrap records for the plan
  const { data: scrapRecords = [] } = useQuery({
    queryKey: ["inventory-scrap", cutPlanId],
    enabled: !!user && !!cutPlanId,
    queryFn: async () => {
      // Get machine run IDs associated with this plan's reservations
      const { data, error } = await supabase
        .from("inventory_scrap")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as ScrapRecord[];
    },
  });

  // WIP batches
  const { data: wipBatches = [] } = useQuery({
    queryKey: ["cut-output-batches", barCode],
    enabled: !!user && !!barCode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cut_output_batches")
        .select("*")
        .eq("bar_code", barCode!)
        .in("status", ["available", "partial"]);
      if (error) throw error;
      return (data || []) as CutOutputBatch[];
    },
  });

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("inventory-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_reservations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["inventory-reservations"] });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_lots" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["inventory-lots"] });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "cut_output_batches" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["cut-output-batches"] });
        })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Compute summary
  const summary: InventorySummary = {
    totalReserved: reservations.filter(r => r.status === "reserved" || r.status === "partial").reduce((s, r) => s + r.qty_reserved, 0),
    totalConsumed: reservations.reduce((s, r) => s + r.qty_consumed, 0),
    remnantsCreated: lots.filter(l => l.source === "remnant").length,
    scrapRecorded: scrapRecords.length,
    reservationsBySource: reservations.reduce((acc, r) => {
      acc[r.source_type] = (acc[r.source_type] || 0) + r.qty_reserved;
      return acc;
    }, {} as Record<string, number>),
  };

  return {
    reservations,
    lots,
    floorStock,
    scrapRecords,
    wipBatches,
    summary,
    isLoading: reservationsLoading || lotsLoading || floorLoading,
  };
}
