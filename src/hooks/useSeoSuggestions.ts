import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBrandKit } from "@/hooks/useBrandKit";
import { useCompanyId } from "@/hooks/useCompanyId";

const VIDEO_FALLBACK = [
  "A cinematic aerial shot of a construction site at golden hour, cranes moving steel beams",
  "Modern office timelapse with people working, natural lighting, professional atmosphere",
  "Close-up of steel rebar being bent by machinery in a workshop, industrial, sparks flying",
  "A drone shot over a completed building project, revealing the cityscape behind it",
];

const IMAGE_FALLBACK = [
  "Professional social media banner for a construction company, modern geometric design, steel blue tones",
  "Flat illustration of a team working together in an office, warm colors, friendly atmosphere",
  "Product photography style shot of steel rebar bundles, dramatic studio lighting, clean background",
  "Minimalist infographic background with abstract shapes, gradient from navy to teal, corporate feel",
];

export function useSeoSuggestions(type: "video" | "image") {
  const { brandKit } = useBrandKit();
  const { companyId } = useCompanyId();
  const fallback = type === "video" ? VIDEO_FALLBACK : IMAGE_FALLBACK;

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["seo_media_suggestions", type, companyId],
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      // Fetch top keywords
      const { data: keywords } = await supabase
        .from("seo_keyword_ai" as any)
        .select("keyword, opportunity_score, impressions_28d, intent")
        .eq("company_id", companyId!)
        .order("opportunity_score", { ascending: false })
        .limit(10);

      if (!keywords?.length) return fallback;

      const brandContext = brandKit
        ? {
            business_name: brandKit.business_name,
            description: brandKit.description,
            value_prop: brandKit.value_prop,
          }
        : undefined;

      try {
        const { data, error } = await supabase.functions.invoke("ai-media-suggestions", {
          body: { type, keywords, brand_context: brandContext },
        });

        if (error) throw error;
        if (data?.suggestions?.length >= 4) return data.suggestions as string[];
      } catch (e) {
        console.warn("SEO suggestions fetch failed, using fallback:", e);
      }

      return fallback;
    },
  });

  return { suggestions: suggestions || fallback, isLoading };
}
