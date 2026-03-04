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
