/**
 * Critical edge function inventory — machine-readable metadata for migration planning.
 * Purely additive. Nothing imports this yet.
 */

export interface EdgeFunctionEntry {
  name: string;
  domain: "auth" | "quotes" | "orders" | "manufacturing" | "delivery" | "accounting" | "comms" | "ai" | "admin" | "infra";
  risk: "critical" | "high" | "medium" | "low";
  purpose: string;
  usesSharedWrapper: boolean;
  hasFeatureFlag: boolean;
  hasSmokeCoverage: boolean;
  hasAuditLogging: boolean;
  migrationPriority: "p0" | "p1" | "p2" | "p3";
  notes?: string;
}

export const edgeFunctionInventory: EdgeFunctionEntry[] = [
  // --- Auth ---
  { name: "google-oauth", domain: "auth", risk: "critical", purpose: "Google OAuth login flow", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p3", notes: "OAuth flow — do not modify" },
  { name: "kiosk-lookup", domain: "auth", risk: "high", purpose: "Workshop kiosk employee lookup by name", usesSharedWrapper: true, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p1", notes: "Migrated to handleRequest in Wave 4" },
  { name: "kiosk-punch", domain: "auth", risk: "high", purpose: "Workshop time clock punch in/out", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },
  { name: "kiosk-register", domain: "auth", risk: "high", purpose: "Workshop kiosk employee registration", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },

  // --- Quotes ---
  { name: "quote-engine", domain: "quotes", risk: "critical", purpose: "Core pricing engine for quotation generation", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: true, hasAuditLogging: false, migrationPriority: "p1", notes: "Core pricing engine" },
  { name: "ai-generate-quotation", domain: "quotes", risk: "high", purpose: "AI-assisted quotation generation from barlist data", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },
  { name: "quote-expiry-watchdog", domain: "quotes", risk: "medium", purpose: "Auto-expire stale quotations past due date", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p3", notes: "Cron job — no user auth, cannot use handleRequest" },

  // --- Orders ---
  { name: "convert-quote-to-order", domain: "orders", risk: "critical", purpose: "Convert accepted quotation into production order", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: true, hasAuditLogging: false, migrationPriority: "p1", notes: "Quote→Order conversion" },
  { name: "odoo-sync-order-lines", domain: "orders", risk: "high", purpose: "Sync order line items to Odoo ERP", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2", notes: "Odoo ERP sync" },

  // --- Manufacturing ---
  { name: "manage-machine", domain: "manufacturing", risk: "high", purpose: "CRUD operations for shop floor machines", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },
  { name: "log-machine-run", domain: "manufacturing", risk: "high", purpose: "Record machine run metrics and production output", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },
  { name: "manage-bend", domain: "manufacturing", risk: "high", purpose: "Manage rebar bending batches and operations", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },
  { name: "manage-extract", domain: "manufacturing", risk: "high", purpose: "Manage barlist extraction sessions and OCR processing", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },
  { name: "manage-inventory", domain: "manufacturing", risk: "high", purpose: "Track raw material and finished goods inventory", usesSharedWrapper: true, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p1", notes: "Migrated to handleRequest in Wave 4" },
  { name: "shape-vision", domain: "manufacturing", risk: "medium", purpose: "AI shape recognition from rebar drawings", usesSharedWrapper: true, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p3", notes: "Migrated to handleRequest in Wave 3" },

  // --- Delivery ---
  { name: "smart-dispatch", domain: "delivery", risk: "critical", purpose: "AI-powered delivery route optimization and dispatch", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p1", notes: "AI dispatch routing" },
  { name: "validate-clearance-photo", domain: "delivery", risk: "medium", purpose: "Validate delivery site clearance photos via AI", usesSharedWrapper: true, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p3", notes: "Migrated to handleRequest in Wave 3" },

  // --- Accounting ---
  { name: "qb-sync-engine", domain: "accounting", risk: "critical", purpose: "Full bidirectional QuickBooks data synchronization", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p1", notes: "QuickBooks full sync" },
  { name: "qb-audit", domain: "accounting", risk: "high", purpose: "Audit QuickBooks sync discrepancies and data integrity", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },
  { name: "qb-webhook", domain: "accounting", risk: "high", purpose: "Handle inbound QuickBooks webhook notifications", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },
  { name: "quickbooks-oauth", domain: "accounting", risk: "critical", purpose: "QuickBooks OAuth token management", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p3", notes: "OAuth — do not modify" },
  { name: "payroll-engine", domain: "accounting", risk: "critical", purpose: "Calculate and process employee payroll", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p1" },
  { name: "auto-reconcile", domain: "accounting", risk: "high", purpose: "Automatically reconcile bank transactions with invoices", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },

  // --- Communications ---
  { name: "gmail-sync", domain: "comms", risk: "high", purpose: "Sync Gmail inbox messages to CRM activity feed", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },
  { name: "gmail-send", domain: "comms", risk: "high", purpose: "Send emails via Gmail API on behalf of users", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },
  { name: "gmail-webhook", domain: "comms", risk: "medium", purpose: "Handle Gmail push notification webhooks", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p3" },
  { name: "ringcentral-sync", domain: "comms", risk: "high", purpose: "Sync RingCentral call logs to CRM", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },
  { name: "ringcentral-webhook", domain: "comms", risk: "high", purpose: "Handle RingCentral event webhooks", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },
  { name: "ringcentral-action", domain: "comms", risk: "medium", purpose: "Execute RingCentral actions (click-to-call, SMS)", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p3" },
  { name: "alert-router", domain: "comms", risk: "high", purpose: "Route system alerts to appropriate channels and users", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },

  // --- AI / Agents ---
  { name: "ai-agent", domain: "ai", risk: "medium", purpose: "General-purpose AI agent for user queries", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p3" },
  { name: "agent-router", domain: "ai", risk: "medium", purpose: "Route requests to appropriate specialized AI agent", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p3" },
  { name: "autopilot-engine", domain: "ai", risk: "high", purpose: "Execute multi-step autonomous business operations", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },
  { name: "pipeline-ai", domain: "ai", risk: "medium", purpose: "AI-powered CRM pipeline stage suggestions", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p3" },
  { name: "pipeline-automation-engine", domain: "ai", risk: "high", purpose: "Automated pipeline stage transitions and follow-ups", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },

  // --- Admin / Infra ---
  { name: "smoke-tests", domain: "infra", risk: "low", purpose: "System health check and smoke test endpoint", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: true, hasAuditLogging: true, migrationPriority: "p3", notes: "Health check endpoint" },
  { name: "build-learning-pairs", domain: "ai", risk: "low", purpose: "Generate AI training pairs from historical data", usesSharedWrapper: true, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p0", notes: "Migrated to handleRequest in Wave 1" },
  { name: "camera-ping", domain: "infra", risk: "low", purpose: "Camera heartbeat ping endpoint", usesSharedWrapper: true, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p0", notes: "Migrated to handleRequest in Wave 1" },
  { name: "diagnostic-logs", domain: "admin", risk: "low", purpose: "Super admin diagnostic log viewer", usesSharedWrapper: true, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p0", notes: "Migrated to handleRequest in Wave 1" },
  { name: "summarize-call", domain: "comms", risk: "medium", purpose: "AI-powered call transcript summarization", usesSharedWrapper: true, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p1", notes: "Migrated to handleRequest in Wave 3" },
  { name: "translate-message", domain: "comms", risk: "medium", purpose: "Multi-language real-time translation", usesSharedWrapper: true, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p1", notes: "Migrated to handleRequest in Wave 3" },
  { name: "pipeline-digest", domain: "ai", risk: "medium", purpose: "AI-generated pipeline performance digest", usesSharedWrapper: true, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p1", notes: "Migrated to handleRequest in Wave 3" },
  { name: "system-backup", domain: "admin", risk: "high", purpose: "Create and manage system data backups", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p2" },
  { name: "daily-summary", domain: "admin", risk: "low", purpose: "Generate daily business summary reports", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p3" },
  { name: "timeclock-alerts", domain: "admin", risk: "medium", purpose: "Alert on missed punches and overtime violations", usesSharedWrapper: false, hasFeatureFlag: false, hasSmokeCoverage: false, hasAuditLogging: false, migrationPriority: "p3" },
];
