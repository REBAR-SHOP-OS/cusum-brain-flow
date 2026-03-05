import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface ShapeSchematic {
  shape_code: string;
  image_url: string;
}

/**
 * Build a public URL for a storage path in the shape-schematics bucket.
 */
function toPublicUrl(imageUrl: string): string {
  if (imageUrl.startsWith("http")) return imageUrl;
  return `${SUPABASE_URL}/storage/v1/object/public/shape-schematics/${encodeURIComponent(imageUrl)}`;
}

async function fetchSchematics(): Promise<ShapeSchematic[]> {
  const { data, error } = await supabase
    .from("custom_shape_schematics")
    .select("shape_code, image_url")
    .order("shape_code");

  if (error) throw error;
  return (data ?? []).map((s) => ({ ...s, image_url: toPublicUrl(s.image_url) }));
}

/**
 * Fetches all custom shape schematics with React Query caching.
 * All components share a single cached copy — no duplicate network requests.
 */
export function useShapeSchematics() {
  const { data: schematics = [], isLoading: loading } = useQuery({
    queryKey: ["shape-schematics"],
    queryFn: fetchSchematics,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  const lookupMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of schematics) {
      const code = s.shape_code.toUpperCase().trim();
      map.set(code, s.image_url);
      if (code.startsWith("TYPE ")) {
        map.set(code.replace("TYPE ", ""), s.image_url);
      }
    }
    return map;
  }, [schematics]);

  const getShapeImageUrl = (shapeCode: string | null | undefined): string | null => {
    if (!shapeCode) return null;
    const normalized = shapeCode.toUpperCase().trim();
    if (lookupMap.has(normalized)) return lookupMap.get(normalized)!;
    const withPrefix = `TYPE ${normalized}`;
    if (lookupMap.has(withPrefix)) return lookupMap.get(withPrefix)!;
    return null;
  };

  return { schematics, loading, getShapeImageUrl };
}
