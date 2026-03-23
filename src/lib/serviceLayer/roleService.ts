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
    // Step 1: Fetch profiles for this company
    const { data: profiles, error: profilesErr } = await (supabase as any)
      .from("profiles")
      .select("id, user_id, full_name, email")
      .eq("company_id", companyId);

    if (profilesErr) return { ok: false, data: [], error: profilesErr.message };
    if (!profiles || profiles.length === 0) return { ok: true, data: [] };

    // Step 2: Fetch roles for those user_ids (user_roles.user_id = auth.users.id = profiles.user_id)
    const userIds = (profiles as any[]).map((p: any) => p.user_id).filter(Boolean);
    let rolesMap: Record<string, string[]> = {};

    if (userIds.length > 0) {
      const { data: roles, error: rolesErr } = await (supabase as any)
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      if (!rolesErr && roles) {
        for (const r of roles as any[]) {
          if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
          rolesMap[r.user_id].push(r.role);
        }
      }
    }

    // Step 3: Merge
    const mapped = (profiles as any[]).map((p: any) => ({
      userId: p.user_id ?? p.id,
      fullName: p.full_name,
      email: p.email,
      roles: rolesMap[p.user_id] ?? [],
    }));
    return { ok: true, data: mapped };
  } catch (err: any) {
    return { ok: false, data: [], error: err.message };
  }
}
