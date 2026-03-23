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
  status: "active" | "disabled" | "deprecated";
  rollbackSteps: string;
  dependencies: string[];
  createdAt: string;
  notes?: string;
}

export const rolloutRegistry: RolloutEntry[] = [
  {
    flagKey: "use_new_request_handler",
    owner: "platform",
    domain: "infra",
    description: "Opt edge functions into shared requestHandler wrapper (auth + company + logging)",
    targetRoles: [],
    targetUserIds: [],
    phase: "canary",
    status: "active",
    rollbackSteps: "Revert edge function to direct auth/company pattern. No DB changes needed.",
    dependencies: [],
    createdAt: "2026-03-23",
    notes: "Wave 4: 10 functions adopted. kiosk-lookup + manage-inventory added. quote-expiry-watchdog excluded (cron, no user auth).",
  },
  {
    flagKey: "use_new_quote_engine",
    owner: "sales",
    domain: "quotes",
    description: "Route quote operations through quoteService wrapper instead of raw Supabase calls",
    targetRoles: ["admin", "sales"],
    targetUserIds: [],
    phase: "off",
    status: "disabled",
    rollbackSteps: "Revert quote components to direct supabase queries. No data migration needed.",
    dependencies: ["use_new_request_handler"],
    createdAt: "2026-03-23",
    notes: "Depends on requestHandler adoption. Read wrapper exists, write wrapper not yet.",
  },
  {
    flagKey: "use_new_pipeline_ui",
    owner: "sales",
    domain: "crm",
    description: "Enable redesigned pipeline/CRM UI components",
    targetRoles: ["admin", "sales"],
    targetUserIds: [],
    phase: "off",
    status: "disabled",
    rollbackSteps: "Toggle flag off. Old pipeline components remain in place.",
    dependencies: [],
    createdAt: "2026-03-23",
    notes: "UI-only change. No backend dependency.",
  },
  {
    flagKey: "use_structured_logging",
    owner: "platform",
    domain: "infra",
    description: "Enable JSON structured logging in edge functions that have adopted createLogger",
    targetRoles: [],
    targetUserIds: [],
    phase: "canary",
    status: "active",
    rollbackSteps: "Toggle flag off. Functions fall back to console.log.",
    dependencies: [],
    createdAt: "2026-03-23",
    notes: "All handleRequest-adopted functions use ctx.log (structuredLog). 10 functions active.",
  },
  {
    flagKey: "enable_ai_observability",
    owner: "platform",
    domain: "infra",
    description: "Shadow telemetry for AI calls — logs request_id, latency, status, execution_path to ai_execution_log",
    targetRoles: [],
    targetUserIds: [],
    phase: "canary",
    status: "active",
    rollbackSteps: "Set ENABLE_AI_OBSERVABILITY=false or remove env var. No data migration needed.",
    dependencies: [],
    createdAt: "2026-03-23",
    notes: "Phase 1 of AI architecture migration. Fire-and-forget, zero behavior change. Enable for super admins first.",
  },
  {
    flagKey: "enable_policy_router_shadow",
    owner: "platform",
    domain: "infra",
    description: "Shadow comparison — logs what policy router would choose vs actual provider, no behavior change",
    targetRoles: [],
    targetUserIds: [],
    phase: "off",
    status: "active",
    rollbackSteps: "Set ENABLE_POLICY_ROUTER_SHADOW=false. No data migration needed.",
    dependencies: ["enable_ai_observability"],
    createdAt: "2026-03-23",
    notes: "Phase 2 shadow mode. Logs mismatches between policy engine and hardcoded selectModel().",
  },
  {
    flagKey: "use_policy_router",
    owner: "platform",
    domain: "infra",
    description: "Activate policy-driven routing — callAI uses resolvePolicy() output instead of caller-provided provider/model",
    targetRoles: [],
    targetUserIds: [],
    phase: "off",
    status: "disabled",
    rollbackSteps: "Set USE_POLICY_ROUTER=false. Instantly reverts to hardcoded selectModel().",
    dependencies: ["enable_policy_router_shadow"],
    createdAt: "2026-03-23",
    notes: "Phase 2 canary. Not activated until shadow data validates policy accuracy.",
  },
  {
    flagKey: "enable_circuit_breaker",
    owner: "platform",
    domain: "infra",
    description: "In-memory circuit breaker — auto-disables unhealthy providers after consecutive failures",
    targetRoles: [],
    targetUserIds: [],
    phase: "off",
    status: "active",
    rollbackSteps: "Set ENABLE_CIRCUIT_BREAKER=false. Provider calls proceed without breaker checks.",
    dependencies: [],
    createdAt: "2026-03-23",
    notes: "Phase 3 hardening. Trips on 5 consecutive failures or >20% error rate in 5min window.",
  },
  {
    flagKey: "enable_cost_tracking",
    owner: "platform",
    domain: "infra",
    description: "Estimate and log per-call AI cost using llm_provider_pricing table",
    targetRoles: [],
    targetUserIds: [],
    phase: "off",
    status: "active",
    rollbackSteps: "Set ENABLE_COST_TRACKING=false. Cost column stays null in logs.",
    dependencies: ["enable_ai_observability"],
    createdAt: "2026-03-23",
    notes: "Phase 3 hardening. Requires ENABLE_AI_OBSERVABILITY to be active (logs must be written).",
  },
  {
    flagKey: "enable_budget_guardrails",
    owner: "platform",
    domain: "infra",
    description: "Soft budget alerts — logs warning when company AI spend approaches or exceeds monthly limit",
    targetRoles: [],
    targetUserIds: [],
    phase: "off",
    status: "active",
    rollbackSteps: "Set ENABLE_BUDGET_GUARDRAILS=false. No budget checks performed.",
    dependencies: ["enable_cost_tracking"],
    createdAt: "2026-03-23",
    notes: "Phase 3 hardening. Soft guardrail only — never blocks execution. Requires cost tracking.",
  },
];
