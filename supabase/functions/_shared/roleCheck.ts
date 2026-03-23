/**
 * Server-side role validation for edge functions.
 * Uses the same user_roles table as the frontend useUserRole hook.
 * Purely additive — no existing function needs to change.
 */
import { corsHeaders } from "./auth.ts";

type AppRole = "admin" | "sales" | "accounting" | "office" | "workshop" | "field" | "shop_supervisor" | "customer";

/**
 * Check if a user has a specific role.
 * @returns true if the user has the role, false otherwise.
 */
export async function hasRole(
  serviceClient: { from: (table: string) => any },
  userId: string,
  role: AppRole,
): Promise<boolean> {
  const { data, error } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

/**
 * Check if a user has ANY of the specified roles.
 */
export async function hasAnyRole(
  serviceClient: { from: (table: string) => any },
  userId: string,
  roles: AppRole[],
): Promise<boolean> {
  const { data, error } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", roles);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/**
 * Require a user to have a specific role. Throws a 403 Response if not.
 * Caller should catch and return the thrown Response.
 */
export async function requireRole(
  serviceClient: { from: (table: string) => any },
  userId: string,
  role: AppRole,
): Promise<void> {
  const has = await hasRole(serviceClient, userId, role);
  if (!has) {
    throw new Response(
      JSON.stringify({ error: `Forbidden: requires '${role}' role` }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

/**
 * Require a user to have ANY of the specified roles. Throws 403 if none match.
 */
export async function requireAnyRole(
  serviceClient: { from: (table: string) => any },
  userId: string,
  roles: AppRole[],
): Promise<void> {
  const has = await hasAnyRole(serviceClient, userId, roles);
  if (!has) {
    throw new Response(
      JSON.stringify({ error: `Forbidden: requires one of [${roles.join(", ")}] roles` }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}
