import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ShapeSchematic {
  shape_code: string;
  image_url: string;
}

/**
 * Fetches all custom shape schematics and provides a lookup by shape code.
 * Handles format normalization: extract rows use "3", "T2", "S13"
 * while the schematics table stores "TYPE 3", "TYPE T2", "TYPE S13".
 */
export function useShapeSchematics() {
  const [schematics, setSchematics] = useState<ShapeSchematic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase
        .from("custom_shape_schematics")
        .select("shape_code, image_url")
        .order("shape_code");

      if (!error && data) {
        setSchematics(data);
      }
      setLoading(false);
    }
    fetch();
  }, []);

  // Build a normalized lookup map
  const lookupMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of schematics) {
      const code = s.shape_code.toUpperCase().trim();
      map.set(code, s.image_url);

      // Also map without "TYPE " prefix for direct lookups
      if (code.startsWith("TYPE ")) {
        map.set(code.replace("TYPE ", ""), s.image_url);
      }
    }
    return map;
  }, [schematics]);

  /**
   * Look up a shape image URL by code.
   * Accepts formats: "3", "T2", "TYPE 3", "TYPE T2", "STRAIGHT", etc.
   */
  const getShapeImageUrl = (shapeCode: string | null | undefined): string | null => {
    if (!shapeCode) return null;
    const normalized = shapeCode.toUpperCase().trim();

    // Direct match
    if (lookupMap.has(normalized)) return lookupMap.get(normalized)!;

    // Try with "TYPE " prefix
    const withPrefix = `TYPE ${normalized}`;
    if (lookupMap.has(withPrefix)) return lookupMap.get(withPrefix)!;

    return null;
  };

  return { schematics, loading, getShapeImageUrl };
}
