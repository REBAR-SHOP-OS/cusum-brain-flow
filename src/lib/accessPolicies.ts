/**
 * Centralized email-based access policies for the frontend.
 * 
 * IMPORTANT: These are client-side UX gates only — NOT security boundaries.
 * Server-side RLS policies and edge function auth checks are authoritative.
 * 
 * All email-based access checks across the frontend should import from here
 * to prevent drift and ensure consistency.
 */
export const ACCESS_POLICIES = {
  /** Full system access — CEO Portal, diagnostics, admin tools */
  superAdmins: ["sattar@rebar.shop", "radin@rebar.shop"],

  /** Accounting workspace + nav access */
  accountingAccess: ["sattar@rebar.shop", "neel@rebar.shop", "vicky@rebar.shop"],

  /** Blocked from /customers route */
  blockedFromCustomers: ["zahra@rebar.shop"],

  /** Shared shopfloor device accounts — locked to shop routes */
  shopfloorDevices: ["ai@rebar.shop"],

  /** CEO Portal nav visibility */
  ceoPortalAccess: ["sattar@rebar.shop", "radin@rebar.shop"],

  /** Internal domain for basic access checks */
  internalDomain: "@rebar.shop",
} as const;
