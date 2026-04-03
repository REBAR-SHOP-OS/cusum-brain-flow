/**
 * Shared helper to read the workspace timezone from workspace_settings.
 * Falls back to "America/Toronto" on any error.
 */
const DEFAULT_TZ = "America/Toronto";

export async function getWorkspaceTimezone(
  supabaseClient: { from: (table: string) => any },
  companyId?: string | null,
): Promise<string> {
  try {
    let query = supabaseClient
      .from("workspace_settings")
      .select("timezone");

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data?.timezone) return DEFAULT_TZ;
    return data.timezone as string;
  } catch {
    return DEFAULT_TZ;
  }
}
