/**
 * Client-side feature flag service.
 * Calls a SECURITY DEFINER RPC that returns only flags the current user
 * qualifies for — the underlying feature_flags table is admin-only readable
 * to prevent leaking allowed_emails / allowed_user_ids / allowed_roles arrays.
 */
import { supabase } from "@/integrations/supabase/client";

interface EnabledFlag {
  flag_key: string;
  metadata: Record<string, unknown>;
}

let flagCache: Map<string, EnabledFlag> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

async function fetchEnabledFlags(): Promise<Map<string, EnabledFlag>> {
  if (flagCache && Date.now() - lastFetchTime < CACHE_TTL_MS) {
    return flagCache;
  }

  try {
    const { data, error } = await (supabase as any).rpc("get_enabled_features_for_user");

    if (error) {
      console.warn("[FeatureFlags] Failed to fetch:", error.message);
      return flagCache ?? new Map();
    }

    const map = new Map<string, EnabledFlag>();
    for (const row of (data as EnabledFlag[]) ?? []) {
      map.set(row.flag_key, row);
    }

    flagCache = map;
    lastFetchTime = Date.now();
    return map;
  } catch {
    return flagCache ?? new Map();
  }
}

/**
 * Check if a flag is enabled for the current authenticated user.
 * The RPC already applies role / user_id / email targeting server-side.
 * The optional `context` parameter is accepted for backward compatibility
 * but is no longer used — targeting is authoritative server-side.
 */
export async function isFeatureEnabled(
  flagKey: string,
  _context?: { role?: string; userId?: string; email?: string },
): Promise<boolean> {
  const flags = await fetchEnabledFlags();
  return flags.has(flagKey);
}

/** Invalidate the in-memory cache (e.g. after admin updates a flag). */
export function invalidateFlagCache() {
  flagCache = null;
  lastFetchTime = 0;
}

