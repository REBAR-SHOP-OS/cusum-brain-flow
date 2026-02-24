import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface CutPlan {
  id: string;
  company_id: string;
  name: string;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  project_name: string | null;
  project_id: string | null;
  machine_id: string | null;
  customer_name?: string | null;
}

export interface CutPlanItem {
  id: string;
  cut_plan_id: string;
  bar_code: string;
  qty_bars: number;
  cut_length_mm: number;
  pieces_per_bar: number;
  notes: string | null;
  mark_number: string | null;
  drawing_ref: string | null;
  bend_type: string;
  asa_shape_code: string | null;
  total_pieces: number;
  completed_pieces: number;
  needs_fix: boolean;
  bend_dimensions: Record<string, number> | null;
  work_order_id: string | null;
}

export interface RebarSize {
  bar_code: string;
  diameter_mm: number;
  area_mm2: number;
  mass_kg_per_m: number;
  standard: string;
}

export interface MachineCapability {
  id: string;
  machine_id: string;
  bar_code: string;
  process: string;
  max_bars: number;
  bar_mm: number | null;
}

export interface MachineOption {
  id: string;
  name: string;
  model: string | null;
  status: string;
  company_id: string;
}

export function useCutPlans() {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const { toast } = useToast();
  const [plans, setPlans] = useState<CutPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    if (!companyId) { setPlans([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("cut_plans")
      .select("*, projects(name, customer_id, customers(name))")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    if (error) {
      toast({ title: "Error loading cut plans", description: error.message, variant: "destructive" });
    } else {
      const mapped = (data || []).map((row: any) => {
        const { projects, ...rest } = row;
        return {
          ...rest,
          customer_name: projects?.customers?.name || null,
        } as CutPlan;
      });
      setPlans(mapped);
    }
    setLoading(false);
  }, [companyId, toast]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  // Realtime subscription for cut_plans
  useEffect(() => {
    if (!user || !companyId) return;
    const channel = supabase
      .channel("cut-plans-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "cut_plans" },
        () => fetchPlans())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, companyId, fetchPlans]);

  const createPlan = async (name: string, planCompanyId: string) => {
    const { data, error } = await supabase
      .from("cut_plans")
      .insert({ name, company_id: planCompanyId, created_by: user?.id || null })
      .select()
      .single();

    if (error) {
      toast({ title: "Error creating plan", description: error.message, variant: "destructive" });
      return null;
    }
    await fetchPlans();
    return data as CutPlan;
  };

  const updatePlanStatus = async (planId: string, status: string) => {
    const { error } = await supabase
      .from("cut_plans")
      .update({ status })
      .eq("id", planId);

    if (error) {
      toast({ title: "Error updating plan", description: error.message, variant: "destructive" });
      return false;
    }
    await fetchPlans();
    return true;
  };

  const deletePlan = async (planId: string) => {
    const { error: itemsErr } = await supabase
      .from("cut_plan_items")
      .delete()
      .eq("cut_plan_id", planId);
    if (itemsErr) {
      toast({ title: "Error deleting plan items", description: itemsErr.message, variant: "destructive" });
      return false;
    }
    const { error } = await supabase
      .from("cut_plans")
      .delete()
      .eq("id", planId);
    if (error) {
      toast({ title: "Error deleting plan", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Plan deleted" });
    await fetchPlans();
    return true;
  };

  return { plans, loading, fetchPlans, createPlan, updatePlanStatus, deletePlan };
}

export function useCutPlanItems(planId: string | null) {
  const { toast } = useToast();
  const [items, setItems] = useState<CutPlanItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!planId) { setItems([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("cut_plan_items")
      .select("*")
      .eq("cut_plan_id", planId);

    if (error) {
      toast({ title: "Error loading items", description: error.message, variant: "destructive" });
    } else {
      setItems((data as CutPlanItem[]) || []);
    }
    setLoading(false);
  }, [planId, toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = async (item: Omit<CutPlanItem, "id">) => {
    const { error } = await supabase.from("cut_plan_items").insert(item);
    if (error) {
      toast({ title: "Error adding item", description: error.message, variant: "destructive" });
      return false;
    }
    await fetchItems();
    return true;
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("cut_plan_items").delete().eq("id", itemId);
    if (error) {
      toast({ title: "Error removing item", description: error.message, variant: "destructive" });
      return false;
    }
    await fetchItems();
    return true;
  };

  return { items, loading, fetchItems, addItem, removeItem };
}

export function useRebarSizes() {
  const [sizes, setSizes] = useState<RebarSize[]>([]);

  useEffect(() => {
    supabase
      .from("rebar_sizes")
      .select("*")
      .order("diameter_mm", { ascending: true })
      .then(({ data }) => setSizes((data as RebarSize[]) || []));
  }, []);

  return sizes;
}

export function useCutterMachines() {
  const [machines, setMachines] = useState<MachineOption[]>([]);

  useEffect(() => {
    supabase
      .from("machines")
      .select("id, name, model, status, company_id")
      .eq("type", "cutter")
      .then(({ data }) => setMachines((data as MachineOption[]) || []));
  }, []);

  return machines;
}

export function useMachineCapabilities(machineModel: string | null, process: string) {
  const [capabilities, setCapabilities] = useState<MachineCapability[]>([]);

  useEffect(() => {
    if (!machineModel) { setCapabilities([]); return; }

    supabase
      .from("machines")
      .select("id")
      .eq("model", machineModel)
      .then(({ data: machines }) => {
        if (!machines?.length) { setCapabilities([]); return; }
        const machineIds = machines.map(m => m.id);
        supabase
          .from("machine_capabilities")
          .select("*")
          .in("machine_id", machineIds)
          .eq("process", process)
          .then(({ data }) => setCapabilities((data as MachineCapability[]) || []));
      });
  }, [machineModel, process]);

  const getMaxBars = (barCode: string): number | null => {
    const cap = capabilities.find(c => c.bar_code === barCode);
    return cap ? cap.max_bars : null;
  };

  return { capabilities, getMaxBars };
}
