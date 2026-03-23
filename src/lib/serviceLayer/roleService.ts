/**
 * Role service layer — read-only wrappers for role/capability queries.
 * Purely additive. No existing code calls this yet.
 * Note: user_roles table has no company_id — scoping via profiles join per memory.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ServiceResult } from "./types";

export async function getUserRoles(userId: string): Promise<ServiceResult<string[]>> {
  try {
    const { data, error } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) return { ok: false, data: [], error: error.message };
    return { ok: true, data: (data ?? []).map((r: any) => r.role) };
  } catch (err: any) {
    return { ok: false, data: [], error: err.message };
  }
}

export async function hasUserRole(userId: string, role: string): Promise<ServiceResult<boolean>> {
  const result = await getUserRoles(userId);
  if (!result.ok) return { ok: false, data: false, error: result.error };
  return { ok: true, data: result.data.includes(role) };
}

export async function listCompanyUsersWithRoles(companyId: string): Promise<ServiceResult<Array<{ userId: string; fullName: string; email: string; roles: string[] }>>> {
  try {
    const { data, error } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, email, company_id, user_roles!inner(role)")
      .eq("company_id", companyId);

    if (error) return { ok: false, data: [], error: error.message };
    const mapped = (data ?? []).map((p: any) => ({
      userId: p.id,
      fullName: p.full_name,
      email: p.email,
      roles: (p.user_roles ?? []).map((r: any) => r.role),
    }));
    return { ok: true, data: mapped };
  } catch (err: any) {
    return { ok: false, data: [], error: err.message };
  }
}
