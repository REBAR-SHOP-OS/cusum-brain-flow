import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

export interface InventoryCount {
  id: string;
  company_id: string;
  count_number: string;
  status: string;
  count_type: string;
  location: string | null;
  counted_by: string | null;
  approved_by: string | null;
  count_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryCountLine {
  id: string;
  count_id: string;
  bar_code: string;
  expected_qty: number;
  counted_qty: number | null;
  variance: number;
  notes: string | null;
  created_at: string;
}

export function useInventoryCounts() {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();

  const { data: counts = [], isLoading } = useQuery({
    queryKey: ["inventory_counts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("inventory_counts")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InventoryCount[];
    },
    enabled: !!companyId,
  });

  const createCount = useMutation({
    mutationFn: async (input: { count_type: string; location?: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const seq = String(counts.length + 1).padStart(3, "0");

      // Fetch rebar_sizes for pre-populating lines
      const { data: sizes } = await supabase.from("rebar_sizes").select("bar_code").order("bar_code");

      // Get current stock from cut_output_batches
      const { data: stock } = await supabase
        .from("cut_output_batches")
        .select("bar_code, qty_available")
        .eq("company_id", companyId!)
        .gt("qty_available", 0);

      const stockMap = new Map<string, number>();
      (stock || []).forEach(s => {
        stockMap.set(s.bar_code, (stockMap.get(s.bar_code) || 0) + s.qty_available);
      });

      const { data: count, error } = await supabase
        .from("inventory_counts")
        .insert({
          company_id: companyId!,
          count_number: `IC-${today}-${seq}`,
          count_type: input.count_type,
          location: input.location || null,
          notes: input.notes || null,
          counted_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Pre-populate lines from rebar_sizes
      if (sizes && sizes.length > 0) {
        const lines = sizes.map(s => ({
          count_id: count.id,
          bar_code: s.bar_code,
          expected_qty: stockMap.get(s.bar_code) || 0,
        }));
        await supabase.from("inventory_count_lines").insert(lines);
      }

      return count;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory_counts"] }); toast.success("Inventory count created"); },
    onError: (e) => toast.error(e.message),
  });

  const updateCount = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InventoryCount> & { id: string }) => {
      const { error } = await supabase.from("inventory_counts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory_counts"] }); toast.success("Count updated"); },
    onError: (e) => toast.error(e.message),
  });

  return { counts, isLoading, createCount, updateCount };
}

export function useInventoryCountLines(countId: string | null) {
  const qc = useQueryClient();

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["inventory_count_lines", countId],
    queryFn: async () => {
      if (!countId) return [];
      const { data, error } = await supabase
        .from("inventory_count_lines")
        .select("*")
        .eq("count_id", countId)
        .order("bar_code");
      if (error) throw error;
      return data as InventoryCountLine[];
    },
    enabled: !!countId,
  });

  const updateLine = useMutation({
    mutationFn: async ({ id, counted_qty, notes }: { id: string; counted_qty: number | null; notes?: string }) => {
      const { error } = await supabase
        .from("inventory_count_lines")
        .update({ counted_qty, notes: notes || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory_count_lines", countId] }),
    onError: (e) => toast.error(e.message),
  });

  const totalExpected = lines.reduce((s, l) => s + l.expected_qty, 0);
  const totalCounted = lines.reduce((s, l) => s + (l.counted_qty ?? 0), 0);
  const totalVariance = lines.reduce((s, l) => s + l.variance, 0);
  const uncounted = lines.filter(l => l.counted_qty === null).length;

  return { lines, isLoading, updateLine, totalExpected, totalCounted, totalVariance, uncounted };
}
