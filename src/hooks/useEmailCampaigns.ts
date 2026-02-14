import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface EmailCampaign {
  id: string;
  title: string;
  campaign_type: string;
  status: string;
  subject_line: string | null;
  preview_text: string | null;
  body_html: string | null;
  body_text: string | null;
  segment_rules: Record<string, unknown>;
  estimated_recipients: number;
  scheduled_at: string | null;
  sent_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  metadata: Record<string, unknown>;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface EmailSuppression {
  id: string;
  email: string;
  reason: string;
  source: string | null;
  suppressed_at: string;
  company_id: string;
}

export function useEmailCampaigns() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["email_campaigns"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as EmailCampaign[];
    },
  });

  const createCampaign = useMutation({
    mutationFn: async (campaign: Partial<EmailCampaign>) => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .insert(campaign as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_campaigns"] });
      toast.success("Campaign created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<EmailCampaign>) => {
      const { error } = await supabase
        .from("email_campaigns")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { campaigns, isLoading, createCampaign, updateCampaign };
}

export function useSuppressions() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: suppressions = [], isLoading } = useQuery({
    queryKey: ["email_suppressions"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_suppressions")
        .select("*")
        .order("suppressed_at", { ascending: false });
      if (error) throw error;
      return data as unknown as EmailSuppression[];
    },
  });

  const addSuppression = useMutation({
    mutationFn: async (sup: Partial<EmailSuppression>) => {
      const { error } = await supabase
        .from("email_suppressions")
        .insert(sup as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_suppressions"] });
      toast.success("Email suppressed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { suppressions, isLoading, addSuppression };
}
