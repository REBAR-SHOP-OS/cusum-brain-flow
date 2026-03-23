/**
 * Role service layer — read-only wrappers for role/capability queries.
 * Purely additive. No existing code calls this yet.
 * Note: user_roles table has no company_id — scoping via profiles join per memory.
 */
import { supabase } from "@/integrations/supabase/client";

export async function getUserRoles(userId: string): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to get user roles: ${error.message}`);
  return (data ?? []).map((r: any) => r.role);
}

export async function hasUserRole(userId: string, role: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes(role);
}

export async function listCompanyUsersWithRoles(companyId: string) {
  // user_roles lacks company_id — join through profiles to scope by company
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, email, company_id, user_roles!inner(role)")
    .eq("company_id", companyId);

  if (error) throw new Error(`Failed to list company users with roles: ${error.message}`);
  return (data ?? []).map((p: any) => ({
    userId: p.id,
    fullName: p.full_name,
    email: p.email,
    roles: (p.user_roles ?? []).map((r: any) => r.role),
  }));
}
