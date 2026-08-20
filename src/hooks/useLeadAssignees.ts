import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";
import { toast } from "sonner";

export interface LeadAssignee {
  id: string;
  lead_id: string;
  profile_id: string;
  full_name: string;
}

export interface SalesLeadAssignee {
  id: string;
  sales_lead_id: string;
  profile_id: string;
  full_name: string;
}

/** Fetch all lead_assignees for the company (main pipeline) */
export function useLeadAssignees() {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["lead_assignees", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_assignees" as any)
        .select("id, lead_id, profile_id, profiles:profile_id(full_name)")
        .eq("company_id", companyId!);
      if (error) throw error;
      return (data as any[]).map((d) => ({
        id: d.id,
        lead_id: d.lead_id,
        profile_id: d.profile_id,
        full_name: (d.profiles as any)?.full_name || "Unknown",
      })) as LeadAssignee[];
    },
    staleTime: 30_000,
  });

  const addAssignee = useMutation({
    mutationFn: async ({ leadId, profileId }: { leadId: string; profileId: string }) => {
      const { error } = await supabase.from("lead_assignees" as any).insert({
        lead_id: leadId,
        profile_id: profileId,
        company_id: companyId!,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead_assignees", companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAssignee = useMutation({
    mutationFn: async ({ leadId, profileId }: { leadId: string; profileId: string }) => {
      const { error } = await supabase
        .from("lead_assignees" as any)
        .delete()
        .eq("lead_id", leadId)
        .eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead_assignees", companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Group by lead_id for easy lookup
  const byLeadId: Record<string, LeadAssignee[]> = {};
  (query.data ?? []).forEach((a) => {
    if (!byLeadId[a.lead_id]) byLeadId[a.lead_id] = [];
    byLeadId[a.lead_id].push(a);
  });

  return { assignees: query.data ?? [], byLeadId, addAssignee, removeAssignee, isLoading: query.isLoading };
}

/** Fetch all sales_lead_assignees for the company */
export function useSalesLeadAssignees() {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["sales_lead_assignees", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_lead_assignees" as any)
        .select("id, sales_lead_id, profile_id, profiles:profile_id(full_name)")
        .eq("company_id", companyId!);
      if (error) throw error;
      return (data as any[]).map((d) => ({
        id: d.id,
        sales_lead_id: d.sales_lead_id,
        profile_id: d.profile_id,
        full_name: (d.profiles as any)?.full_name || "Unknown",
      })) as SalesLeadAssignee[];
    },
    staleTime: 30_000,
  });

  const addAssignee = useMutation({
    mutationFn: async ({ salesLeadId, profileId }: { salesLeadId: string; profileId: string }) => {
      const { error } = await supabase.from("sales_lead_assignees" as any).insert({
        sales_lead_id: salesLeadId,
        profile_id: profileId,
        company_id: companyId!,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales_lead_assignees", companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAssignee = useMutation({
    mutationFn: async ({ salesLeadId, profileId }: { salesLeadId: string; profileId: string }) => {
      const { error } = await supabase
        .from("sales_lead_assignees" as any)
        .delete()
        .eq("sales_lead_id", salesLeadId)
        .eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales_lead_assignees", companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Group by sales_lead_id for easy lookup
  const bySalesLeadId: Record<string, SalesLeadAssignee[]> = {};
  (query.data ?? []).forEach((a) => {
    if (!bySalesLeadId[a.sales_lead_id]) bySalesLeadId[a.sales_lead_id] = [];
    bySalesLeadId[a.sales_lead_id].push(a);
  });

  return { assignees: query.data ?? [], bySalesLeadId, addAssignee, removeAssignee, isLoading: query.isLoading };
}
