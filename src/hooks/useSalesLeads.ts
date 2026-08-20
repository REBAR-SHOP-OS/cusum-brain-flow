import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";
import { useEffect } from "react";
import { toast } from "sonner";

export const SALES_STAGES = [
  { id: "prospecting", label: "Prospecting", color: "#6366f1" },
  { id: "new", label: "New", color: "#3b82f6" },
  { id: "telephonic_enquiries", label: "Telephonic Enquiries", color: "#06b6d4" },
  { id: "qc_ben", label: "QC - Ben", color: "#84cc16" },
  { id: "estimation_ben", label: "Estimation - Ben", color: "#f59e0b" },
  { id: "estimation_karthick", label: "Estimation - Karthick", color: "#f97316" },
  { id: "estimation_others", label: "Estimation - Others", color: "#d97706" },
  { id: "estimation_partha", label: "Estimation Partha", color: "#fbbf24" },
  { id: "hot_enquiries", label: "Hot Enquiries", color: "#ef4444" },
  { id: "qualified", label: "Qualified", color: "#14b8a6" },
  { id: "rfi", label: "RFI", color: "#22c55e" },
  { id: "addendums", label: "Addendums", color: "#eab308" },
  { id: "quotation_priority", label: "Quotation Priority", color: "#f43f5e" },
  { id: "quotation_bids", label: "Quotation Bids", color: "#ec4899" },
  { id: "won", label: "Won", color: "#10b981" },
  { id: "lost", label: "Lost", color: "#71717a" },
  { id: "loss", label: "Loss", color: "#a1a1aa" },
  { id: "merged", label: "Merged", color: "#52525b" },
  { id: "shop_drawing", label: "Shop Drawing", color: "#8b5cf6" },
  { id: "shop_drawing_approval", label: "Shop Drawing Sent for Approval", color: "#a855f7" },
  { id: "fabrication_in_shop", label: "Fabrication In Shop", color: "#7c3aed" },
  { id: "ready_to_dispatch", label: "Ready To Dispatch/Pickup", color: "#34d399" },
  { id: "delivered_pickup_done", label: "Delivered/Pickup Done", color: "#059669" },
  { id: "out_for_delivery", label: "Out for Delivery", color: "#0ea5e9" },
  { id: "no_rebars_out_of_scope", label: "No rebars (Out of Scope)", color: "#78716c" },
  { id: "temp_ir_vam", label: "Temp: IR/VAM", color: "#d946ef" },
  { id: "migration_others", label: "Migration-Others", color: "#64748b" },
  { id: "dreamers", label: "Dreamers", color: "#38bdf8" },
  { id: "archived_orphan", label: "Archived / Orphan", color: "#3f3f46" },
] as const;

export type SalesLead = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  stage: string;
  probability: number | null;
  expected_value: number | null;
  expected_close_date: string | null;
  source: string | null;
  assigned_to: string | null;
  priority: string | null;
  notes: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_company: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type SalesLeadInsert = {
  title: string;
  description?: string | null;
  stage?: string;
  probability?: number | null;
  expected_value?: number | null;
  expected_close_date?: string | null;
  source?: string | null;
  assigned_to?: string | null;
  priority?: string | null;
  notes?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_company?: string | null;
};

type SalesLeadUpdate = Partial<SalesLeadInsert> & { id: string };

export function useSalesLeads() {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["sales_leads", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_leads")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SalesLead[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("sales_leads_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_leads" }, () => {
        qc.invalidateQueries({ queryKey: ["sales_leads", companyId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, qc]);

  const createLead = useMutation({
    mutationFn: async (lead: SalesLeadInsert) => {
      const { data, error } = await supabase
        .from("sales_leads")
        .insert({ ...lead, company_id: companyId! } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales_leads", companyId] }); toast.success("Lead created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, ...updates }: SalesLeadUpdate) => {
      const { error } = await supabase.from("sales_leads").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales_leads", companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales_leads", companyId] }); toast.success("Lead deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { leads: query.data ?? [], isLoading: query.isLoading, createLead, updateLead, deleteLead };
}
