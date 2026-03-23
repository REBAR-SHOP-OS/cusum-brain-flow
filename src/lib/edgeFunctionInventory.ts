/**
 * Critical edge function inventory — machine-readable metadata for migration planning.
 * Purely additive. Nothing imports this yet.
 */

export interface EdgeFunctionEntry {
  name: string;
  domain: "auth" | "quotes" | "orders" | "manufacturing" | "delivery" | "accounting" | "comms" | "ai" | "admin" | "infra";
  risk: "critical" | "high" | "medium" | "low";
  usesSharedWrapper: boolean;
  hasFeatureFlag: boolean;
  hasSmokeCoverage: boolean;
  notes?: string;
}

export const edgeFunctionInventory: EdgeFunctionEntry[] = [
  // --- Auth ---
  { name: "google-oauth", domain: "auth", risk: "critical", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, notes: "OAuth flow — do not modify" },
  { name: "kiosk-lookup", domain: "auth", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, notes: "Workshop kiosk login" },
  { name: "kiosk-punch", domain: "auth", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, notes: "Workshop time clock" },
  { name: "kiosk-register", domain: "auth", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },

  // --- Quotes ---
  { name: "quote-engine", domain: "quotes", risk: "critical", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: true, notes: "Core pricing engine" },
  { name: "ai-generate-quotation", domain: "quotes", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "quote-expiry-watchdog", domain: "quotes", risk: "medium", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },

  // --- Orders ---
  { name: "convert-quote-to-order", domain: "orders", risk: "critical", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: true, notes: "Quote→Order conversion" },
  { name: "odoo-sync-order-lines", domain: "orders", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, notes: "Odoo ERP sync" },

  // --- Manufacturing ---
  { name: "manage-machine", domain: "manufacturing", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "log-machine-run", domain: "manufacturing", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "manage-bend", domain: "manufacturing", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "manage-extract", domain: "manufacturing", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "manage-inventory", domain: "manufacturing", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "shape-vision", domain: "manufacturing", risk: "medium", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, notes: "AI shape recognition" },

  // --- Delivery ---
  { name: "smart-dispatch", domain: "delivery", risk: "critical", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, notes: "AI dispatch routing" },
  { name: "validate-clearance-photo", domain: "delivery", risk: "medium", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },

  // --- Accounting ---
  { name: "qb-sync-engine", domain: "accounting", risk: "critical", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, notes: "QuickBooks full sync" },
  { name: "qb-audit", domain: "accounting", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "qb-webhook", domain: "accounting", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "quickbooks-oauth", domain: "accounting", risk: "critical", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, notes: "OAuth — do not modify" },
  { name: "payroll-engine", domain: "accounting", risk: "critical", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "auto-reconcile", domain: "accounting", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },

  // --- Communications ---
  { name: "gmail-sync", domain: "comms", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "gmail-send", domain: "comms", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "gmail-webhook", domain: "comms", risk: "medium", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "ringcentral-sync", domain: "comms", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "ringcentral-webhook", domain: "comms", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "ringcentral-action", domain: "comms", risk: "medium", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "alert-router", domain: "comms", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },

  // --- AI / Agents ---
  { name: "ai-agent", domain: "ai", risk: "medium", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "agent-router", domain: "ai", risk: "medium", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "autopilot-engine", domain: "ai", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "pipeline-ai", domain: "ai", risk: "medium", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "pipeline-automation-engine", domain: "ai", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },

  // --- Admin / Infra ---
  { name: "smoke-tests", domain: "infra", risk: "low", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: true, notes: "Health check endpoint" },
  { name: "build-learning-pairs", domain: "ai", risk: "low", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, notes: "Safe candidate for first wrapper migration" },
  { name: "system-backup", domain: "admin", risk: "high", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "daily-summary", domain: "admin", risk: "low", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
  { name: "timeclock-alerts", domain: "admin", risk: "medium", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false },
];
