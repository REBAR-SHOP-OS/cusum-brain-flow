/**
 * Shared helper to read the workspace timezone from workspace_settings.
 * Falls back to "America/Toronto" on any error.
 */
const DEFAULT_TZ = "America/Toronto";

export async function getWorkspaceTimezone(
  supabaseClient: { from: (table: string) => any }
): Promise<string> {
  try {
    const { data, error } = await supabaseClient
      .from("workspace_settings")
      .select("timezone")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.timezone) return DEFAULT_TZ;
    return data.timezone as string;
  } catch {
    return DEFAULT_TZ;
  }
}
