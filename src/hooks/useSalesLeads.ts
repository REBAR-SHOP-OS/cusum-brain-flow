import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";
import { useEffect } from "react";
import { toast } from "sonner";

export const SALES_STAGES = [
  { id: "new", label: "New", color: "#3b82f6" },
  { id: "contacted", label: "Contacted", color: "#8b5cf6" },
  { id: "qualified", label: "Qualified", color: "#06b6d4" },
  { id: "estimating", label: "Estimating", color: "#f59e0b" },
  { id: "quote_sent", label: "Quote Sent", color: "#ec4899" },
  { id: "follow_up", label: "Follow Up", color: "#f97316" },
  { id: "won", label: "Won", color: "#22c55e" },
  { id: "lost", label: "Lost", color: "#6b7280" },
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
    mutationFn: async (lead: Partial<SalesLead> & { title: string }) => {
      const { data, error } = await supabase
        .from("sales_leads")
        .insert({ ...lead, company_id: companyId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales_leads", companyId] }); toast.success("Lead created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SalesLead> & { id: string }) => {
      const { error } = await supabase.from("sales_leads").update(updates).eq("id", id);
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
