import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

export const APPLICANT_STAGES = [
  { key: "applied", label: "Applied", color: "bg-blue-500" },
  { key: "screening", label: "Screening", color: "bg-cyan-500" },
  { key: "phone_interview", label: "Phone Interview", color: "bg-violet-500" },
  { key: "technical_interview", label: "Technical Interview", color: "bg-amber-500" },
  { key: "final_interview", label: "Final Interview", color: "bg-orange-500" },
  { key: "offer", label: "Offer", color: "bg-emerald-500" },
  { key: "hired", label: "Hired", color: "bg-green-600" },
  { key: "rejected", label: "Rejected", color: "bg-red-500" },
] as const;

export type ApplicantStage = (typeof APPLICANT_STAGES)[number]["key"];

export function useRecruitment() {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();

  const positions = useQuery({
    queryKey: ["job_positions", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_positions")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const applicants = useQuery({
    queryKey: ["job_applicants", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_applicants")
        .select("*, job_positions(title)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createPosition = useMutation({
    mutationFn: async (pos: { title: string; department?: string; location?: string; employment_type?: string; description?: string; requirements?: string; salary_range_min?: number; salary_range_max?: number }) => {
      const { error } = await supabase.from("job_positions").insert({ ...pos, company_id: companyId! });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job_positions"] }); toast.success("Position created"); },
    onError: (e) => toast.error(e.message),
  });

  const updatePosition = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [k: string]: any }) => {
      const { error } = await supabase.from("job_positions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job_positions"] }); toast.success("Position updated"); },
    onError: (e) => toast.error(e.message),
  });

  const createApplicant = useMutation({
    mutationFn: async (app: { position_id: string; first_name: string; last_name: string; email?: string; phone?: string; source?: string; notes?: string }) => {
      const { error } = await supabase.from("job_applicants").insert({ ...app, company_id: companyId! });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job_applicants"] }); toast.success("Applicant added"); },
    onError: (e) => toast.error(e.message),
  });

  const moveApplicant = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: ApplicantStage }) => {
      const { error } = await supabase.from("job_applicants").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job_applicants"] }); },
    onError: (e) => toast.error(e.message),
  });

  const updateApplicant = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [k: string]: any }) => {
      const { error } = await supabase.from("job_applicants").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job_applicants"] }); toast.success("Applicant updated"); },
    onError: (e) => toast.error(e.message),
  });

  return {
    positions: positions.data ?? [],
    applicants: applicants.data ?? [],
    isLoading: positions.isLoading || applicants.isLoading,
    createPosition,
    updatePosition,
    createApplicant,
    moveApplicant,
    updateApplicant,
  };
}
