/**
 * Robust boolean parsing for environment feature flags.
 * Handles: "true", "True", " true ", '"true"', "1", "yes", "on" etc.
 */
export function isEnabled(envKey: string, defaultValue = false): boolean {
  const raw = Deno.env.get(envKey);
  if (raw == null) return defaultValue;
  const normalized = raw.trim().toLowerCase().replace(/^["']|["']$/g, "");
  return ["true", "1", "yes", "on"].includes(normalized);
}

/**
 * Smart fail-open guard for Odoo integration.
 * - Explicitly disabled ("false","0","no","off") → blocked
 * - Explicitly enabled ("true","1","yes","on") → allowed
 * - Otherwise: if ODOO_URL + ODOO_API_KEY exist → allowed (fail-open)
 */
export function isOdooEnabled(): boolean {
  const raw = Deno.env.get("ODOO_ENABLED");
  if (raw != null) {
    const n = raw.trim().toLowerCase().replace(/^["']|["']$/g, "");
    if (["false", "0", "no", "off"].includes(n)) return false;
    if (["true", "1", "yes", "on"].includes(n)) return true;
  }
  // Fail-open: if credentials exist, allow sync
  return !!(Deno.env.get("ODOO_URL") && Deno.env.get("ODOO_API_KEY"));
}
