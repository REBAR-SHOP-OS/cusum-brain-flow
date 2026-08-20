/**
 * Server-side role validation for edge functions.
 * Uses the same user_roles table as the frontend useUserRole hook.
 * Purely additive — no existing function needs to change.
 */
import { corsHeaders } from "./auth.ts";
import { SUPER_ADMIN_EMAILS } from "./accessPolicies.ts";

type AppRole =
  | "admin"
  | "sales"
  | "accounting"
  | "office"
  | "workshop"
  | "field"
  | "shop_supervisor"
  | "customer"
  | "marketing";

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
  // Super admin bypass — same pattern as requireSuperAdmin()
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();
  const email = (profile?.email ?? "").toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(email)) return;

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
  // Super admin bypass — same pattern as requireSuperAdmin()
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();
  const email = (profile?.email ?? "").toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(email)) return;

  const has = await hasAnyRole(serviceClient, userId, roles);
  if (!has) {
    throw new Response(
      JSON.stringify({ error: `Forbidden: requires one of [${roles.join(", ")}] roles` }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

/**
 * Require super admin access. Uses role-first strategy with email fallback.
 * 
 * Priority:
 * 1. Check if user has 'admin' role in user_roles table
 * 2. If role check is inconclusive, fall back to shared SUPER_ADMIN_EMAILS allowlist
 * 
 * This provides backward compatibility while the system transitions
 * from email-based to role-based access control.
 * 
 * @throws Response(403) if user is not a super admin
 */
export async function requireSuperAdmin(
  serviceClient: { from: (table: string) => any },
  userId: string,
): Promise<void> {
  // 1. Role-first: check admin role
  const isAdmin = await hasRole(serviceClient, userId, "admin");
  if (isAdmin) return;

  // 2. Email fallback: check shared super admin list
  const { data } = await serviceClient
    .from("profiles")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();

  const email = (data?.email ?? "").toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(email)) return;

  throw new Response(
    JSON.stringify({ error: "Forbidden: Super admin access only" }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
