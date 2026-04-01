/**
 * Centralized company_id resolution for edge functions.
 * Replaces 85+ copy-pasted lookups with a single cached call.
 * Purely additive — existing functions don't need to change.
 */
import { cacheGet, cacheSet } from "./cache.ts";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Resolve a user's company_id from the profiles table.
 * Results are cached in-memory for 5 minutes per userId.
 *
 * @param serviceClient - Supabase client with service_role key
 * @param userId - The authenticated user's UUID
 * @returns companyId string
 * @throws Response(400) if no company found
 */
export async function resolveCompanyId(
  serviceClient: { from: (table: string) => any },
  userId: string,
): Promise<string> {
  const cacheKey = `company:${userId}`;
  const cached = cacheGet<string>(cacheKey);
  if (cached) return cached;

  const { data, error } = await serviceClient
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve company: ${error.message}`);
  }

  if (!data?.company_id) {
    throw new Error("No company found for user");
  }

  cacheSet(cacheKey, data.company_id, CACHE_TTL_MS);
  return data.company_id;
}

/**
 * Resolve a default company_id for cron/system functions that have no user context.
 * Looks up the first active company. Cached for the function lifetime.
 * Falls back to provided fallback if no companies exist (should never happen in production).
 */
export async function resolveDefaultCompanyId(
  serviceClient: { from: (table: string) => any },
): Promise<string> {
  const cacheKey = "company:default";
  const cached = cacheGet<string>(cacheKey);
  if (cached) return cached;

  const { data } = await serviceClient
    .from("companies")
    .select("id")
    .limit(1)
    .maybeSingle();

  const companyId = data?.id;
  if (!companyId) {
    throw new Error("No company found in system");
  }

  cacheSet(cacheKey, companyId, CACHE_TTL_MS);
  return companyId;
}
