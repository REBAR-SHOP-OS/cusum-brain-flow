import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { BrandProfile } from "@/types/adDirector";

/** Maps BrandProfile ↔ brand_kit table for Ad Director persistence */
export function useAdDirectorBrandKit() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: savedBrand, isLoading } = useQuery({
    queryKey: ["ad_director_brand_kit"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("brand_kit" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) return null;

      const row = data as any;
      const colors = (typeof row.colors === "object" && row.colors) || {};

      return {
        name: row.business_name || "",
        website: row.website || "",
        tagline: row.tagline || "",
        cta: row.cta || "",
        logoUrl: row.logo_url || null,
        primaryColor: colors.primary || "#ef4444",
        secondaryColor: colors.secondary || "#1e293b",
        fontStyle: row.font_style || "Modern Sans-Serif",
        targetAudience: row.target_audience || "",
        referenceAesthetic: row.reference_aesthetic || "Premium cinematic industrial B2B",
      } as BrandProfile;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (brand: BrandProfile) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("brand_kit" as any)
        .upsert({
          user_id: user.id,
          business_name: brand.name,
          website: brand.website,
          tagline: brand.tagline,
          cta: brand.cta,
          logo_url: brand.logoUrl,
          colors: { primary: brand.primaryColor, secondary: brand.secondaryColor, tertiary: "" },
          target_audience: brand.targetAudience,
          font_style: brand.fontStyle,
          reference_aesthetic: brand.referenceAesthetic,
          description: brand.targetAudience,
          value_prop: brand.tagline,
          brand_voice: "",
          media_urls: [],
        } as any, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad_director_brand_kit"] });
      toast({ title: "Brand Kit saved", description: "Your brand identity has been persisted." });
    },
    onError: (err: Error) => {
      toast({ title: "Error saving Brand Kit", description: err.message, variant: "destructive" });
    },
  });

  return { savedBrand, isLoading, saveBrandKit: saveMutation };
}
