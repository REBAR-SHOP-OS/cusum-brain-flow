import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface BrandKit {
  id: string;
  user_id: string;
  business_name: string;
  logo_url: string | null;
  brand_voice: string;
  description: string;
  value_prop: string;
  colors: { primary: string; secondary: string; tertiary: string };
  media_urls: string[];
  created_at: string;
  updated_at: string;
}

export function useBrandKit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: brandKit, isLoading } = useQuery({
    queryKey: ["brand_kit"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("brand_kit" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && !error.message.includes("does not exist")) {
        console.error("Brand kit fetch error:", error);
      }
      return (data as unknown as BrandKit) ?? null;
    },
  });

  const saveBrandKit = useMutation({
    mutationFn: async (kit: Omit<BrandKit, "id" | "created_at" | "updated_at" | "user_id">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("brand_kit" as any)
        .upsert({
          user_id: user.id,
          ...kit,
        } as any, { onConflict: "user_id" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand_kit"] });
      toast({ title: "Brand Kit saved", description: "Your brand identity has been persisted." });
    },
    onError: (err: Error) => {
      toast({ title: "Error saving Brand Kit", description: err.message, variant: "destructive" });
    },
  });

  return { brandKit, isLoading, saveBrandKit };
}
