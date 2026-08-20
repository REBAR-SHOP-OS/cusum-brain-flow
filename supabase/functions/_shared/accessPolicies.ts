/**
 * Centralized email-based access policies for edge functions.
 * Server-side authoritative source for super admin and device account checks.
 * 
 * All edge functions that check super admin email access should import from here
 * instead of maintaining local constants.
 */
export const SUPER_ADMIN_EMAILS: readonly string[] = [
  "sattar@rebar.shop",
  "radin@rebar.shop",
  "zahra@rebar.shop",
];

/** Device/service accounts with special system access (e.g. backup) */
export const SYSTEM_DEVICE_EMAILS: readonly string[] = [
  "ai@rebar.shop",
];
