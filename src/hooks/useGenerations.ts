import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Generation {
  id: string;
  user_id: string;
  raw_prompt: string;
  engineered_prompt: string | null;
  intent: string | null;
  mode: string;
  duration_seconds: number;
  aspect_ratio: string;
  provider: string | null;
  status: string;
  estimated_credits: number;
  actual_credits: number;
  output_asset_url: string | null;
  job_id: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export function useGenerations() {
  const queryClient = useQueryClient();

  const { data: generations, isLoading } = useQuery({
    queryKey: ["generations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Generation[];
    },
  });

  const createGeneration = useMutation({
    mutationFn: async (gen: {
      raw_prompt: string;
      engineered_prompt?: string;
      intent?: string;
      mode: string;
      duration_seconds: number;
      aspect_ratio: string;
      provider?: string;
      estimated_credits: number;
      metadata?: Record<string, any>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("generations")
        .insert({
          user_id: user.id,
          raw_prompt: gen.raw_prompt,
          engineered_prompt: gen.engineered_prompt || null,
          intent: gen.intent || null,
          mode: gen.mode,
          duration_seconds: gen.duration_seconds,
          aspect_ratio: gen.aspect_ratio,
          provider: gen.provider || null,
          status: "queued",
          estimated_credits: gen.estimated_credits,
          metadata: gen.metadata || {},
        })
        .select()
        .single();
      if (error) throw error;
      return data as Generation;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["generations"] }),
  });

  const updateGeneration = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Generation> & { id: string }) => {
      const { error } = await supabase
        .from("generations")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["generations"] }),
  });

  return { generations, isLoading, createGeneration, updateGeneration };
}
