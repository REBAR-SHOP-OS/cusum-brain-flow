/**
 * Runtime kill-switch for internal alert emails.
 * Reads the `comms_alerts_enabled` feature flag at call time so admins can
 * pause/resume from the UI without redeploying.
 *
 * Returns true when alerts SHOULD be paused (either env override or DB flag is off).
 */
export async function isAlertSendingDisabled(svc: any): Promise<{ disabled: boolean; reason?: string }> {
  const env = (Deno.env.get("COMMS_ALERTS_DISABLED") || "").toLowerCase().trim();
  if (env === "1" || env === "true" || env === "yes" || env === "on") {
    return { disabled: true, reason: "COMMS_ALERTS_DISABLED env" };
  }
  try {
    const { data } = await svc
      .from("feature_flags")
      .select("enabled")
      .eq("flag_key", "comms_alerts_enabled")
      .maybeSingle();
    // Default: enabled (only pause when row exists AND enabled=false)
    if (data && data.enabled === false) {
      return { disabled: true, reason: "feature_flags.comms_alerts_enabled=false" };
    }
  } catch (err) {
    console.warn("[alert-kill-switch] flag read failed, defaulting to enabled:", err);
  }
  return { disabled: false };
}
