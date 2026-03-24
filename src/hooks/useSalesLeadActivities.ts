import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SalesLeadActivity = {
  id: string;
  sales_lead_id: string;
  company_id: string;
  activity_type: string;
  subject: string | null;
  body: string | null;
  user_id: string | null;
  user_name: string | null;
  scheduled_date: string | null;
  completed_at: string | null;
  created_at: string;
};

type CreateActivity = {
  sales_lead_id: string;
  company_id: string;
  activity_type: string;
  subject?: string;
  body?: string;
  user_name?: string;
  scheduled_date?: string;
};

export function useSalesLeadActivities(salesLeadId: string | undefined) {
  const qc = useQueryClient();
  const qk = ["sales_lead_activities", salesLeadId];

  const query = useQuery({
    queryKey: qk,
    enabled: !!salesLeadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_lead_activities")
        .select("*")
        .eq("sales_lead_id", salesLeadId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SalesLeadActivity[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: CreateActivity) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("sales_lead_activities").insert({
        ...input,
        user_id: user?.id,
        user_name: input.user_name || user?.email || "Unknown",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast.success("Activity logged");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sales_lead_activities")
        .update({ completed_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    activities: query.data ?? [],
    isLoading: query.isLoading,
    create,
    markDone,
  };
}
