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
  superAdmins: ["sattar@rebar.shop", "radin@rebar.shop", "zahra@rebar.shop"] as string[],

  /** Accounting workspace + nav access */
  accountingAccess: ["sattar@rebar.shop", "neel@rebar.shop", "vicky@rebar.shop"] as string[],

  /** Blocked from /customers route */
  blockedFromCustomers: [] as string[],

  /** Blocked from /shop-floor and /shopfloor routes */
  blockedFromShopFloor: [] as string[],

  /** Shared shopfloor device accounts — locked to shop routes */
  shopfloorDevices: ["ai@rebar.shop"] as string[],

  /** CEO Portal nav visibility */
  ceoPortalAccess: ["sattar@rebar.shop", "radin@rebar.shop", "zahra@rebar.shop"] as string[],

  /** External estimators — email → allowed pipeline stage ids */
  externalEstimators: {
    "info@mavericksrebar.com": ["estimation_karthick"],
    "swapnil.m183@gmail.com": ["estimation_karthick"],
  } as Record<string, string[]>,

  /** Internal domain for basic access checks */
  internalDomain: "@rebar.shop",

  /** Exhaustive whitelist — only these emails may sign in */
  allowedLoginEmails: [
    "sattar@rebar.shop",
    "radin@rebar.shop",
    "zahra@rebar.shop",
    "neel@rebar.shop",
    "vicky@rebar.shop",
    "kourosh@rebar.shop",
    "saurabh@rebar.shop",
    "ben@rebar.shop",
    "ai@rebar.shop",
    "swapnil.m183@gmail.com",
    "tariq0001010@gmail.com",
    "ontariorebars6@gmail.com",
  ] as string[],
};
