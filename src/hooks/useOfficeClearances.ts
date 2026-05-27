import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";

export type OfficeClearanceStatus = "pending" | "approved" | "rejected";

export interface OfficeClearance {
  id: string;
  company_id: string;
  session_id: string | null;
  order_id: string | null;
  title: string;
  notes: string | null;
  status: OfficeClearanceStatus;
  requested_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useOfficeClearances() {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["office_clearances", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_clearances" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OfficeClearance[];
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("office-clearances-" + companyId + "-" + Math.random().toString(36).slice(2, 8))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "office_clearances", filter: `company_id=eq.${companyId}` },
        () => qc.invalidateQueries({ queryKey: ["office_clearances", companyId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, qc]);

  const create = useMutation({
    mutationFn: async (input: { title: string; notes?: string; session_id?: string | null }) => {
      if (!companyId) throw new Error("No company");
      const user = await getCurrentUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("office_clearances" as any).insert({
        company_id: companyId,
        requested_by: user.id,
        title: input.title,
        notes: input.notes ?? null,
        session_id: input.session_id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["office_clearances", companyId] }),
  });

  const review = useMutation({
    mutationFn: async (input: { id: string; status: "approved" | "rejected" }) => {
      const user = await getCurrentUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("office_clearances" as any)
        .update({
          status: input.status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["office_clearances", companyId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("office_clearances" as any)
        .delete()
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Delete blocked (no permission)");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["office_clearances", companyId] }),
  });

  return { ...query, create, review, remove };
}
