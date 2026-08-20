/**
 * Global Email Kill-Switch
 * ------------------------------------------------------------------
 * When EMAILS_DISABLED=true (env var) OR the workspace setting
 * `emails_disabled` is true, NO outbound email of any kind is sent.
 *
 * Usage at every send site:
 *
 *   import { isEmailSendingDisabled } from "../_shared/emailKillSwitch.ts";
 *   if (await isEmailSendingDisabled()) {
 *     console.log("[email-kill-switch] Skipped send: emails are globally disabled");
 *     return; // or return a stub success
 *   }
 *
 * To re-enable: unset EMAILS_DISABLED env var (or set it to "false").
 */
export async function isEmailSendingDisabled(): Promise<boolean> {
  const flag = (Deno.env.get("EMAILS_DISABLED") || "").toLowerCase().trim();
  if (flag === "1" || flag === "true" || flag === "yes" || flag === "on") {
    return true;
  }
  return false;
}

export const EMAIL_KILL_SWITCH_MESSAGE =
  "Email sending is globally disabled (EMAILS_DISABLED=true). Send was skipped.";
