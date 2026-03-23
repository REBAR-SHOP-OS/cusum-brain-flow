/**
 * Client-side feature flag service.
 * Fetches flags from the feature_flags table, caches in memory.
 * Purely additive — no existing code depends on this.
 */
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface FeatureFlag {
  flag_key: string;
  enabled: boolean;
  allowed_roles: string[];
  allowed_user_ids: string[];
  allowed_emails: string[];
  metadata: Record<string, unknown>;
}

let flagCache: Map<string, FeatureFlag> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Fetch all feature flags (with client-side caching).
 */
async function fetchFlags(): Promise<Map<string, FeatureFlag>> {
  if (flagCache && Date.now() - lastFetchTime < CACHE_TTL_MS) {
    return flagCache;
  }

  try {
    const { data, error } = await (supabase as any)
      .from("feature_flags")
      .select("flag_key, enabled, allowed_roles, allowed_user_ids, allowed_emails, metadata");

    if (error) {
      console.warn("[FeatureFlags] Failed to fetch:", error.message);
      return flagCache ?? new Map();
    }

    const map = new Map<string, FeatureFlag>();
    for (const row of data ?? []) {
      map.set(row.flag_key, row as FeatureFlag);
    }

    flagCache = map;
    lastFetchTime = Date.now();
    return map;
  } catch {
    return flagCache ?? new Map();
  }
}

/**
 * Check if a flag is enabled. Returns false on any error.
 * Optionally checks role/userId/email for targeted rollouts.
 */
export async function isFeatureEnabled(
  flagKey: string,
  context?: { role?: string; userId?: string; email?: string },
): Promise<boolean> {
  const flags = await fetchFlags();
  const flag = flags.get(flagKey);
  if (!flag) return false;
  if (!flag.enabled) return false;

  // If no targeting arrays set, flag is globally enabled
  const hasTargeting =
    flag.allowed_roles.length > 0 ||
    flag.allowed_user_ids.length > 0 ||
    flag.allowed_emails.length > 0;

  if (!hasTargeting) return true;

  // Check targeting
  if (context?.role && flag.allowed_roles.includes(context.role)) return true;
  if (context?.userId && flag.allowed_user_ids.includes(context.userId)) return true;
  if (context?.email && flag.allowed_emails.includes(context.email)) return true;

  return false;
}

/**
 * React hook to check a feature flag.
 * Returns { enabled, isLoading }.
 */
export function useFeatureFlag(
  flagKey: string,
  context?: { role?: string; userId?: string; email?: string },
) {
  const { data: enabled = false, isLoading } = useQuery({
    queryKey: ["feature_flag", flagKey, context?.role, context?.userId],
    queryFn: () => isFeatureEnabled(flagKey, context),
    staleTime: CACHE_TTL_MS,
    refetchOnWindowFocus: false,
  });

  return { enabled, isLoading };
}

/** Invalidate the in-memory cache (e.g. after admin updates a flag). */
export function invalidateFlagCache() {
  flagCache = null;
  lastFetchTime = 0;
}
