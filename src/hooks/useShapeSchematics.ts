import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ShapeSchematic {
  shape_code: string;
  image_url: string;
}

/**
 * Extract storage path from a full public/signed URL or return as-is if already a path.
 */
function extractStoragePath(url: string): string | null {
  const marker = "/object/public/shape-schematics/";
  const idx = url.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(url.slice(idx + marker.length));
  // Already a relative path
  if (!url.startsWith("http")) return url;
  return null;
}

const SIGNED_URL_EXPIRY = 3600; // 1 hour
const CURRENT_HOST = new URL(import.meta.env.VITE_SUPABASE_URL).host;

/**
 * Fetches all custom shape schematics and provides a lookup by shape code.
 * Uses signed URLs only for files in the current project's private bucket.
 * External/public URLs are used as-is.
 */
export function useShapeSchematics() {
  const [schematics, setSchematics] = useState<ShapeSchematic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSchematics() {
      const { data, error } = await supabase
        .from("custom_shape_schematics")
        .select("shape_code, image_url")
        .order("shape_code");

      if (!error && data) {
        const withSignedUrls = await Promise.all(
          data.map(async (s) => {
            const path = extractStoragePath(s.image_url);

            if (path) {
              // Storage path (relative or extracted from bucket URL) — always sign
              const { data: signedData } = await supabase.storage
                .from("shape-schematics")
                .createSignedUrl(path, SIGNED_URL_EXPIRY);
              return { ...s, image_url: signedData?.signedUrl || s.image_url };
            }
            // Full external URL with no extractable path — use as-is
            return s;
          })
        );
        setSchematics(withSignedUrls);
      }
      setLoading(false);
    }
    fetchSchematics();
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
