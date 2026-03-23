/**
 * Rollout governance registry — typed metadata for all feature flags.
 * Purely additive. Nothing imports this yet. Used for planning and admin tooling.
 */

export interface RolloutEntry {
  flagKey: string;
  owner: string;
  domain: string;
  description: string;
  targetRoles: string[];
  targetUserIds: string[];
  phase: "off" | "canary" | "percentage" | "ga";
  rollbackSteps: string;
  dependencies: string[];
  createdAt: string;
}

export const rolloutRegistry: RolloutEntry[] = [
  {
    flagKey: "use_new_request_handler",
    owner: "platform",
    domain: "infra",
    description: "Opt edge functions into shared requestHandler wrapper (auth + company + logging)",
    targetRoles: [],
    targetUserIds: [],
    phase: "off",
    rollbackSteps: "Revert edge function to direct auth/company pattern. No DB changes needed.",
    dependencies: [],
    createdAt: "2026-03-23",
  },
  {
    flagKey: "use_new_quote_engine",
    owner: "sales",
    domain: "quotes",
    description: "Route quote operations through quoteService wrapper instead of raw Supabase calls",
    targetRoles: ["admin", "sales"],
    targetUserIds: [],
    phase: "off",
    rollbackSteps: "Revert quote components to direct supabase queries. No data migration needed.",
    dependencies: ["use_new_request_handler"],
    createdAt: "2026-03-23",
  },
  {
    flagKey: "use_new_pipeline_ui",
    owner: "sales",
    domain: "crm",
    description: "Enable redesigned pipeline/CRM UI components",
    targetRoles: ["admin", "sales"],
    targetUserIds: [],
    phase: "off",
    rollbackSteps: "Toggle flag off. Old pipeline components remain in place.",
    dependencies: [],
    createdAt: "2026-03-23",
  },
  {
    flagKey: "use_structured_logging",
    owner: "platform",
    domain: "infra",
    description: "Enable JSON structured logging in edge functions that have adopted createLogger",
    targetRoles: [],
    targetUserIds: [],
    phase: "off",
    rollbackSteps: "Toggle flag off. Functions fall back to console.log.",
    dependencies: [],
    createdAt: "2026-03-23",
  },
];
