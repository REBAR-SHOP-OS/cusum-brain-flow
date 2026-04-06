import type {
  DiagnosticIssue,
  RepairHandlerRegistry,
  RepairResult,
  WorkflowGraphBundle,
  WorkflowLayerGroup,
  WorkflowModuleDetail,
  WorkflowModuleKind,
  WorkflowRegistry,
} from "@/types/workflowDiagram";
import { addMinutes, subMinutes } from "date-fns";

function nowIso() {
  return new Date().toISOString();
}

function minutesAgoIso(min: number) {
  return subMinutes(new Date(), min).toISOString();
}

function minutesFromNowIso(min: number) {
  return addMinutes(new Date(), min).toISOString();
}

function moduleBase(args: {
  id: string;
  name: string;
  kind: WorkflowModuleKind;
  group: WorkflowLayerGroup;
  description: string;
  parentId?: string;
  childModuleIds?: string[];
  childGraphId?: string;
  healthStatus?: WorkflowModuleDetail["healthStatus"];
  errorCount?: number;
  warningCount?: number;
  logsSummary?: string;
  inputs?: string[];
  outputs?: string[];
  dependencies?: string[];
  events?: string[];
  apis?: string[];
  webhooks?: string[];
  jobs?: string[];
  databaseEntities?: string[];
  suggestedActions?: string[];
  apiInfo?: WorkflowModuleDetail["apiInfo"];
  webhookInfo?: WorkflowModuleDetail["webhookInfo"];
}): WorkflowModuleDetail {
  return {
    id: args.id,
    name: args.name,
    kind: args.kind,
    group: args.group,
    description: args.description,
    parentId: args.parentId,
    childModuleIds: args.childModuleIds ?? [],
    childGraphId: args.childGraphId,
    inputs: args.inputs ?? [],
    outputs: args.outputs ?? [],
    dependencies: args.dependencies ?? [],
    events: args.events ?? [],
    apis: args.apis ?? [],
    webhooks: args.webhooks ?? [],
    jobs: args.jobs ?? [],
    databaseEntities: args.databaseEntities ?? [],
    healthStatus: args.healthStatus ?? "unknown",
    lastUpdatedAt: minutesAgoIso(6),
    errorCount: args.errorCount ?? 0,
    warningCount: args.warningCount ?? 0,
    logsSummary: args.logsSummary ?? "No recent logs.",
    suggestedActions: args.suggestedActions ?? [],
    apiInfo: args.apiInfo,
    webhookInfo: args.webhookInfo,
  };
}

const modules: Record<string, WorkflowModuleDetail> = {
  // Root
  people: moduleBase({
    id: "people",
    name: "People",
    kind: "layer",
    group: "user_interface",
    description: "User entrypoint: UI, sessions, permissions, and identity context.",
    childModuleIds: ["people-ui", "people-auth", "people-permissions"],
    childGraphId: "people-internal",
    healthStatus: "healthy",
    logsSummary: "Session checks stable. No auth error spikes detected.",
    suggestedActions: ["Review role assignments", "Audit session expiry settings"],
    inputs: ["Browser requests", "User credentials", "Deep links"],
    outputs: ["Authenticated session", "User context", "Navigation intents"],
    dependencies: ["Core"],
    events: ["login.success", "login.failed", "session.refreshed"],
    apis: ["GET /me", "POST /auth/login"],
  }),
  signals: moduleBase({
    id: "signals",
    name: "Signals",
    kind: "layer",
    group: "automation_signals",
    description: "Automation intake: webhooks, schedules, and job triggers.",
    childModuleIds: ["signals-webhooks", "signals-scheduler", "signals-workers"],
    childGraphId: "signals-internal",
    healthStatus: "warning",
    warningCount: 2,
    logsSummary: "Webhook traffic normal. One worker shows intermittent retries.",
    suggestedActions: ["Re-run failed job batch", "Validate webhook signing secret"],
    inputs: ["Inbound webhooks", "Cron schedules", "Queue messages"],
    outputs: ["Events to Core", "Job execution results"],
    dependencies: ["Core", "Partners"],
    webhooks: ["POST /webhooks/*"],
    jobs: ["sync_contacts", "daily_digest"],
  }),
  core: moduleBase({
    id: "core",
    name: "Core",
    kind: "layer",
    group: "core_data_api",
    description: "Central system of record: APIs, data, orchestration, and shared services.",
    childModuleIds: ["core-api", "core-db", "core-queue", "core-edge"],
    childGraphId: "core-internal",
    healthStatus: "warning",
    warningCount: 1,
    logsSummary: "Elevated API latency on /sync; DB healthy; queue depth stable.",
    suggestedActions: ["Inspect /sync latency", "Review recent deploy diffs"],
    inputs: ["UI requests", "Automation events", "Partner callbacks"],
    outputs: ["API responses", "Derived events", "Notifications"],
    dependencies: ["Partners", "Monitoring"],
    apis: ["GET /api/*", "POST /api/*"],
    databaseEntities: ["users", "sessions", "events", "notifications"],
  }),
  partners: moduleBase({
    id: "partners",
    name: "Partners",
    kind: "layer",
    group: "external_integrations",
    description: "Outbound integrations: payment, telephony, social, email, and third-party APIs.",
    childModuleIds: ["partners-http", "partners-auth", "partners-rate"],
    childGraphId: "partners-internal",
    healthStatus: "error",
    errorCount: 3,
    logsSummary: "Timeouts detected calling External CRM. Rate limit backoff engaged.",
    suggestedActions: ["Retry CRM sync with backoff", "Confirm partner API status"],
    inputs: ["Core API calls", "Partner webhooks"],
    outputs: ["Partner API responses", "Callbacks to Core"],
    dependencies: ["Core"],
    apis: ["POST https://partner.example.com/v1/*"],
    webhooks: ["POST /webhooks/partner/*"],
  }),
  you: moduleBase({
    id: "you",
    name: "You",
    kind: "layer",
    group: "user_interface",
    description: "Experience layer: dashboards, notifications, and action loops.",
    childModuleIds: ["you-notify", "you-inbox", "you-actions"],
    childGraphId: "you-internal",
    healthStatus: "healthy",
    logsSummary: "Notification delivery stable. UI error boundary quiet.",
    suggestedActions: ["Configure alert routing", "Review unread message backlog"],
    inputs: ["Core responses", "Push events"],
    outputs: ["User actions", "Acknowledgements", "Feedback reports"],
    dependencies: ["Core", "Monitoring"],
    events: ["notification.received", "action.submitted"],
  }),
  monitoring: moduleBase({
    id: "monitoring",
    name: "Monitoring",
    kind: "layer",
    group: "monitoring_health",
    description: "Observability: health checks, metrics, traces, and incident signals.",
    childModuleIds: ["mon-health", "mon-metrics", "mon-alerts"],
    childGraphId: "monitoring-internal",
    healthStatus: "healthy",
    logsSummary: "All checks passing. One partner latency alert active.",
    suggestedActions: ["Tune API timeout thresholds", "Review alert fatigue"],
    inputs: ["Logs", "Metrics", "Traces", "Heartbeats"],
    outputs: ["Alerts", "Incident tickets", "Suggested actions"],
    dependencies: ["Core", "Partners", "Signals"],
  }),
  fix_center: moduleBase({
    id: "fix_center",
    name: "Fix Center",
    kind: "layer",
    group: "fix_center",
    description: "Failure diagnostics and guided repair flows. Supports attachable real handlers later.",
    childModuleIds: ["fix-issues", "fix-runbooks", "fix-actions"],
    childGraphId: "fix-internal",
    healthStatus: "unknown",
    logsSummary: "Diagnostics engine ready. No repair handlers attached.",
    suggestedActions: ["Review active issues", "Run guided fix on critical failures"],
    inputs: ["Monitoring signals", "Module health", "Edge failures"],
    outputs: ["Repair plans", "Retry actions", "Resolution states"],
    dependencies: ["Monitoring"],
  }),

  // People internals
  "people-ui": moduleBase({
    id: "people-ui",
    name: "UI Routes",
    kind: "component",
    group: "user_interface",
    description: "Front-end routing, layout, and guarded navigation.",
    parentId: "people",
    healthStatus: "healthy",
    inputs: ["User navigation intents"],
    outputs: ["API calls to Core"],
    dependencies: ["core-api"],
    apis: ["GET /api/navigation-links"],
  }),
  "people-auth": moduleBase({
    id: "people-auth",
    name: "Auth Session",
    kind: "component",
    group: "app_auth",
    description: "Session management and token refresh.",
    parentId: "people",
    healthStatus: "healthy",
    inputs: ["Credentials", "Refresh tokens"],
    outputs: ["Session context", "Access tokens"],
    dependencies: ["core-api"],
    events: ["auth.token.refreshed"],
    suggestedActions: ["Verify refresh cadence"],
  }),
  "people-permissions": moduleBase({
    id: "people-permissions",
    name: "Role Guard",
    kind: "component",
    group: "app_auth",
    description: "Permission checks and feature access gates.",
    parentId: "people",
    healthStatus: "healthy",
    inputs: ["User roles", "Workspace policy"],
    outputs: ["Allow/deny decisions"],
    dependencies: ["core-db"],
  }),

  // Signals internals
  "signals-webhooks": moduleBase({
    id: "signals-webhooks",
    name: "Webhook Gateway",
    kind: "component",
    group: "automation_signals",
    description: "Ingress for webhooks. Validates signatures and normalizes events.",
    parentId: "signals",
    healthStatus: "healthy",
    inputs: ["Inbound webhooks"],
    outputs: ["Normalized events"],
    dependencies: ["core-edge", "core-queue"],
    webhooks: ["POST /webhooks/ringcentral", "POST /webhooks/partner"],
    events: ["webhook.received", "webhook.rejected"],
  }),
  "signals-scheduler": moduleBase({
    id: "signals-scheduler",
    name: "Scheduler",
    kind: "component",
    group: "automation_signals",
    description: "Time-based triggers for recurring jobs and audits.",
    parentId: "signals",
    healthStatus: "warning",
    warningCount: 1,
    logsSummary: "One scheduled task exceeded expected runtime (p95).",
    inputs: ["Cron schedule"],
    outputs: ["Job dispatch"],
    dependencies: ["core-queue"],
    jobs: ["daily_digest", "weekly_audit"],
    suggestedActions: ["Check slow job traces"],
  }),
  "signals-workers": moduleBase({
    id: "signals-workers",
    name: "Workers",
    kind: "component",
    group: "automation_signals",
    description: "Executes queued jobs and emits results.",
    parentId: "signals",
    healthStatus: "warning",
    warningCount: 1,
    logsSummary: "Retries increased for partner sync job.",
    inputs: ["Queue messages"],
    outputs: ["Job results", "Events to Core"],
    dependencies: ["partners-http", "core-api"],
    jobs: ["sync_contacts", "sync_orders"],
  }),

  // Core internals
  "core-api": moduleBase({
    id: "core-api",
    name: "API Gateway",
    kind: "component",
    group: "core_data_api",
    description: "Unified entrypoint for UI and automation API calls.",
    parentId: "core",
    healthStatus: "warning",
    warningCount: 1,
    logsSummary: "p95 latency elevated on POST /sync (timeouts near threshold).",
    inputs: ["REST calls", "Auth context"],
    outputs: ["DB queries", "Events", "Responses"],
    dependencies: ["core-db", "core-edge", "core-queue"],
    apis: ["GET /api/*", "POST /api/sync", "POST /api/events"],
    suggestedActions: ["Inspect /sync dependency chain", "Lower batch size on sync"],
    apiInfo: {
      baseUrl: "/api",
      endpoints: [
        { method: "POST", path: "/sync", notes: "Batch sync to external partners." },
        { method: "POST", path: "/events", notes: "Event ingest from webhooks and UI." },
      ],
    },
  }),
  "core-db": moduleBase({
    id: "core-db",
    name: "Database",
    kind: "component",
    group: "core_data_api",
    description: "System of record for users, sessions, events, jobs, and notifications.",
    parentId: "core",
    healthStatus: "healthy",
    inputs: ["Queries", "Transactions"],
    outputs: ["Rows", "Triggers", "Change feeds"],
    dependencies: [],
    databaseEntities: ["users", "workspaces", "events", "jobs", "notifications"],
    events: ["db.trigger.notification_created"],
  }),
  "core-queue": moduleBase({
    id: "core-queue",
    name: "Queue",
    kind: "component",
    group: "core_data_api",
    description: "Async job queue for sync, delivery, and heavy compute.",
    parentId: "core",
    healthStatus: "healthy",
    inputs: ["Job dispatch"],
    outputs: ["Work items", "DLQ entries"],
    dependencies: ["core-db"],
    jobs: ["sync_contacts", "deliver_notifications"],
  }),
  "core-edge": moduleBase({
    id: "core-edge",
    name: "Edge Functions",
    kind: "component",
    group: "core_data_api",
    description: "Event-driven handlers: webhooks, push, scheduling, and partner adapters.",
    parentId: "core",
    healthStatus: "healthy",
    inputs: ["Webhook payloads", "DB triggers"],
    outputs: ["Normalized events", "Partner requests", "Push jobs"],
    dependencies: ["partners-http", "core-queue", "core-db"],
    webhooks: ["POST /functions/*"],
  }),

  // Partners internals
  "partners-http": moduleBase({
    id: "partners-http",
    name: "HTTP Client",
    kind: "component",
    group: "external_integrations",
    description: "Outbound HTTP requests to partner APIs with retries and timeouts.",
    parentId: "partners",
    healthStatus: "error",
    errorCount: 2,
    logsSummary: "Timeouts on POST /crm/sync. Backoff engaged.",
    inputs: ["Core sync requests"],
    outputs: ["Partner responses", "Errors/timeouts"],
    dependencies: ["partners-auth", "partners-rate"],
    apis: ["POST https://partner.example.com/v1/crm/sync"],
    suggestedActions: ["Increase timeout temporarily", "Reduce batch size"],
  }),
  "partners-auth": moduleBase({
    id: "partners-auth",
    name: "Auth + Tokens",
    kind: "component",
    group: "external_integrations",
    description: "Stores and refreshes partner access tokens.",
    parentId: "partners",
    healthStatus: "healthy",
    inputs: ["Refresh tokens"],
    outputs: ["Access tokens"],
    dependencies: ["core-db"],
    events: ["partner.token.refreshed"],
  }),
  "partners-rate": moduleBase({
    id: "partners-rate",
    name: "Rate Limiter",
    kind: "component",
    group: "external_integrations",
    description: "Applies quota rules and retry policy for partner APIs.",
    parentId: "partners",
    healthStatus: "warning",
    warningCount: 1,
    inputs: ["Request intents"],
    outputs: ["Backoff decisions"],
    dependencies: [],
    logsSummary: "Near quota. Backoff active for CRM endpoints.",
  }),

  // You internals
  "you-notify": moduleBase({
    id: "you-notify",
    name: "Notifications",
    kind: "component",
    group: "user_interface",
    description: "In-app notifications and push routing.",
    parentId: "you",
    healthStatus: "healthy",
    inputs: ["Notification events"],
    outputs: ["Toasts", "Push sends"],
    dependencies: ["core-queue"],
  }),
  "you-inbox": moduleBase({
    id: "you-inbox",
    name: "Inbox",
    kind: "component",
    group: "user_interface",
    description: "Message + support inbox and triage actions.",
    parentId: "you",
    healthStatus: "healthy",
    inputs: ["Threads", "Messages"],
    outputs: ["Replies", "Assignments"],
    dependencies: ["core-api"],
  }),
  "you-actions": moduleBase({
    id: "you-actions",
    name: "Actions",
    kind: "component",
    group: "user_interface",
    description: "User-initiated workflows: approvals, retries, and escalations.",
    parentId: "you",
    healthStatus: "healthy",
    inputs: ["Clicks", "Commands"],
    outputs: ["API calls", "Events"],
    dependencies: ["core-api"],
    events: ["action.retry", "action.resolve"],
  }),

  // Monitoring internals
  "mon-health": moduleBase({
    id: "mon-health",
    name: "Health Checks",
    kind: "component",
    group: "monitoring_health",
    description: "Heartbeat and endpoint health probes.",
    parentId: "monitoring",
    healthStatus: "healthy",
    inputs: ["Probe schedules"],
    outputs: ["Health signals"],
    dependencies: ["core-api", "partners-http"],
  }),
  "mon-metrics": moduleBase({
    id: "mon-metrics",
    name: "Metrics + Traces",
    kind: "component",
    group: "monitoring_health",
    description: "Collects latency, error rates, and trace spans across modules.",
    parentId: "monitoring",
    healthStatus: "healthy",
    inputs: ["Spans", "Counters", "Logs"],
    outputs: ["Dashboards", "SLO evaluations"],
    dependencies: [],
  }),
  "mon-alerts": moduleBase({
    id: "mon-alerts",
    name: "Alert Router",
    kind: "component",
    group: "monitoring_health",
    description: "Routes incidents to Fix Center and notification channels.",
    parentId: "monitoring",
    healthStatus: "healthy",
    inputs: ["Triggered alerts"],
    outputs: ["Incident events"],
    dependencies: ["fix-issues", "you-notify"],
    events: ["alert.triggered", "incident.created"],
  }),

  // Fix Center internals
  "fix-issues": moduleBase({
    id: "fix-issues",
    name: "Issue Detector",
    kind: "component",
    group: "fix_center",
    description: "Aggregates failures from monitoring and module health state.",
    parentId: "fix_center",
    healthStatus: "unknown",
    inputs: ["Alerts", "Health signals"],
    outputs: ["Issue list"],
    dependencies: ["mon-alerts", "mon-health"],
  }),
  "fix-runbooks": moduleBase({
    id: "fix-runbooks",
    name: "Runbooks",
    kind: "component",
    group: "fix_center",
    description: "Guided checklists that suggest actions based on issue class.",
    parentId: "fix_center",
    healthStatus: "unknown",
    inputs: ["Issue class"],
    outputs: ["Repair steps"],
    dependencies: [],
  }),
  "fix-actions": moduleBase({
    id: "fix-actions",
    name: "Repair Actions",
    kind: "component",
    group: "fix_center",
    description: "Pluggable handlers (mock today) to retry/fix/resolve issues.",
    parentId: "fix_center",
    healthStatus: "unknown",
    inputs: ["Issue id", "Confirmation"],
    outputs: ["Repair result"],
    dependencies: ["core-api", "partners-http"],
  }),
};

const graphs: Record<string, WorkflowGraphBundle> = {
  root: {
    id: "root",
    label: "Full System Workflow",
    nodes: [
      { id: "n-people", moduleId: "people", position: { x: 80, y: 90 } },
      { id: "n-signals", moduleId: "signals", position: { x: 80, y: 380 } },
      { id: "n-core", moduleId: "core", position: { x: 470, y: 240 } },
      { id: "n-partners", moduleId: "partners", position: { x: 870, y: 90 } },
      { id: "n-you", moduleId: "you", position: { x: 870, y: 380 } },
      { id: "n-monitoring", moduleId: "monitoring", position: { x: 470, y: 30 } },
      { id: "n-fix", moduleId: "fix_center", position: { x: 470, y: 470 } },
    ],
    edges: [
      { id: "e-people-core", source: "n-people", target: "n-core", kind: "user_action", label: "UI → API" },
      { id: "e-signals-core", source: "n-signals", target: "n-core", kind: "event", label: "events" },
      { id: "e-core-partners", source: "n-core", target: "n-partners", kind: "api", label: "HTTP out" },
      { id: "e-partners-core", source: "n-partners", target: "n-core", kind: "webhook", label: "callbacks" },
      { id: "e-core-you", source: "n-core", target: "n-you", kind: "data", label: "responses" },
      { id: "e-monitoring-core", source: "n-monitoring", target: "n-core", kind: "event", label: "health" },
      { id: "e-monitoring-partners", source: "n-monitoring", target: "n-partners", kind: "event", label: "latency" },
      { id: "e-monitoring-fix", source: "n-monitoring", target: "n-fix", kind: "event", label: "incidents" },
      { id: "e-fix-core", source: "n-fix", target: "n-core", kind: "job", label: "repairs" },
    ],
  },
  "people-internal": {
    id: "people-internal",
    label: "People (internal)",
    nodes: [
      { id: "p-ui", moduleId: "people-ui", position: { x: 120, y: 160 } },
      { id: "p-auth", moduleId: "people-auth", position: { x: 120, y: 320 } },
      { id: "p-perm", moduleId: "people-permissions", position: { x: 430, y: 240 } },
      { id: "p-coreapi", moduleId: "core-api", position: { x: 720, y: 240 } },
    ],
    edges: [
      { id: "e-ui-auth", source: "p-ui", target: "p-auth", kind: "user_action", label: "login" },
      { id: "e-auth-perm", source: "p-auth", target: "p-perm", kind: "data", label: "session" },
      { id: "e-perm-core", source: "p-perm", target: "p-coreapi", kind: "api", label: "authorized calls" },
    ],
  },
  "signals-internal": {
    id: "signals-internal",
    label: "Signals (internal)",
    nodes: [
      { id: "s-web", moduleId: "signals-webhooks", position: { x: 130, y: 160 } },
      { id: "s-sch", moduleId: "signals-scheduler", position: { x: 130, y: 340 } },
      { id: "s-work", moduleId: "signals-workers", position: { x: 430, y: 250 } },
      { id: "s-queue", moduleId: "core-queue", position: { x: 700, y: 170 } },
      { id: "s-coreapi", moduleId: "core-api", position: { x: 700, y: 330 } },
    ],
    edges: [
      { id: "e-web-queue", source: "s-web", target: "s-queue", kind: "event", label: "enqueue" },
      { id: "e-sch-queue", source: "s-sch", target: "s-queue", kind: "job", label: "dispatch" },
      { id: "e-queue-work", source: "s-queue", target: "s-work", kind: "job", label: "work items" },
      { id: "e-work-core", source: "s-work", target: "s-coreapi", kind: "api", label: "results" },
    ],
  },
  "core-internal": {
    id: "core-internal",
    label: "Core (internal)",
    nodes: [
      { id: "c-api", moduleId: "core-api", position: { x: 120, y: 240 } },
      { id: "c-db", moduleId: "core-db", position: { x: 430, y: 120 } },
      { id: "c-queue", moduleId: "core-queue", position: { x: 430, y: 340 } },
      { id: "c-edge", moduleId: "core-edge", position: { x: 720, y: 240 } },
      { id: "c-partners-http", moduleId: "partners-http", position: { x: 980, y: 240 } },
    ],
    edges: [
      { id: "e-api-db", source: "c-api", target: "c-db", kind: "data", label: "queries" },
      { id: "e-api-queue", source: "c-api", target: "c-queue", kind: "job", label: "async" },
      { id: "e-db-edge", source: "c-db", target: "c-edge", kind: "event", label: "trigger" },
      { id: "e-edge-partners", source: "c-edge", target: "c-partners-http", kind: "api", label: "HTTP out" },
      { id: "e-partners-edge", source: "c-partners-http", target: "c-edge", kind: "event", label: "timeouts" },
    ],
  },
  "partners-internal": {
    id: "partners-internal",
    label: "Partners (internal)",
    nodes: [
      { id: "x-http", moduleId: "partners-http", position: { x: 140, y: 240 } },
      { id: "x-auth", moduleId: "partners-auth", position: { x: 430, y: 120 } },
      { id: "x-rate", moduleId: "partners-rate", position: { x: 430, y: 360 } },
      { id: "x-coreapi", moduleId: "core-api", position: { x: 760, y: 240 } },
    ],
    edges: [
      { id: "e-http-auth", source: "x-http", target: "x-auth", kind: "data", label: "tokens" },
      { id: "e-http-rate", source: "x-rate", target: "x-http", kind: "event", label: "quota" },
      { id: "e-core-http", source: "x-coreapi", target: "x-http", kind: "api", label: "sync" },
      { id: "e-http-core", source: "x-http", target: "x-coreapi", kind: "event", label: "errors" },
    ],
  },
  "you-internal": {
    id: "you-internal",
    label: "You (internal)",
    nodes: [
      { id: "y-notify", moduleId: "you-notify", position: { x: 140, y: 130 } },
      { id: "y-inbox", moduleId: "you-inbox", position: { x: 140, y: 340 } },
      { id: "y-actions", moduleId: "you-actions", position: { x: 430, y: 240 } },
      { id: "y-coreapi", moduleId: "core-api", position: { x: 760, y: 240 } },
    ],
    edges: [
      { id: "e-core-notify", source: "y-coreapi", target: "y-notify", kind: "event", label: "push" },
      { id: "e-core-inbox", source: "y-coreapi", target: "y-inbox", kind: "data", label: "threads" },
      { id: "e-actions-core", source: "y-actions", target: "y-coreapi", kind: "api", label: "commands" },
    ],
  },
  "monitoring-internal": {
    id: "monitoring-internal",
    label: "Monitoring (internal)",
    nodes: [
      { id: "m-health", moduleId: "mon-health", position: { x: 140, y: 140 } },
      { id: "m-metrics", moduleId: "mon-metrics", position: { x: 140, y: 330 } },
      { id: "m-alerts", moduleId: "mon-alerts", position: { x: 480, y: 240 } },
      { id: "m-fix", moduleId: "fix_center", position: { x: 800, y: 240 } },
    ],
    edges: [
      { id: "e-health-alerts", source: "m-health", target: "m-alerts", kind: "event", label: "probe results" },
      { id: "e-metrics-alerts", source: "m-metrics", target: "m-alerts", kind: "event", label: "thresholds" },
      { id: "e-alerts-fix", source: "m-alerts", target: "m-fix", kind: "event", label: "incident" },
    ],
  },
  "fix-internal": {
    id: "fix-internal",
    label: "Fix Center (internal)",
    nodes: [
      { id: "f-issues", moduleId: "fix-issues", position: { x: 140, y: 240 } },
      { id: "f-runbooks", moduleId: "fix-runbooks", position: { x: 440, y: 120 } },
      { id: "f-actions", moduleId: "fix-actions", position: { x: 440, y: 360 } },
      { id: "f-core", moduleId: "core-api", position: { x: 780, y: 240 } },
    ],
    edges: [
      { id: "e-issues-runbooks", source: "f-issues", target: "f-runbooks", kind: "data", label: "classify" },
      { id: "e-runbooks-actions", source: "f-runbooks", target: "f-actions", kind: "job", label: "steps" },
      { id: "e-actions-core", source: "f-actions", target: "f-core", kind: "api", label: "retry/repair" },
    ],
  },
};

export const WORKFLOW_REGISTRY_MOCK: WorkflowRegistry = {
  modules,
  graphs,
};

export const DIAGNOSTICS_ISSUES_MOCK: DiagnosticIssue[] = [
  {
    id: "issue-crm-timeouts",
    severity: "critical",
    category: "timeouts",
    title: "Partner CRM timeouts during sync",
    description:
      "Outbound requests to the partner CRM exceed the timeout threshold. Backoff engaged; sync batches remain incomplete.",
    affectedModuleIds: ["partners-http", "core-api", "signals-workers"],
    relatedEdgeIds: ["e-core-partners", "e-edge-partners", "e-partners-edge"],
    suggestedFixes: [
      "Reduce batch size for /sync requests.",
      "Temporarily increase partner timeout and enable circuit-breaker.",
      "Retry the last failed job batch with backoff.",
    ],
    actions: ["view_details", "inspect_source", "retry", "fix_now", "mark_resolved"],
    lastDetectedAt: minutesAgoIso(4),
  },
  {
    id: "issue-missing-webhook-secret",
    severity: "high",
    category: "missing_configs",
    title: "Webhook signing secret missing",
    description: "One inbound webhook route is missing a signing secret configuration. Requests may be rejected.",
    affectedModuleIds: ["signals-webhooks"],
    suggestedFixes: ["Set `WEBHOOK_SIGNING_SECRET` for the webhook gateway.", "Rotate the secret and redeploy handlers."],
    actions: ["view_details", "inspect_source", "fix_now", "mark_resolved"],
    lastDetectedAt: minutesAgoIso(18),
  },
  {
    id: "issue-slow-scheduler-job",
    severity: "medium",
    category: "failing_jobs",
    title: "Scheduled job exceeded expected runtime",
    description: "The scheduler's weekly audit job exceeded expected runtime (p95). Retries not required yet.",
    affectedModuleIds: ["signals-scheduler"],
    suggestedFixes: ["Inspect job trace spans.", "Split audit into smaller steps."],
    actions: ["view_details", "retry", "mark_resolved"],
    lastDetectedAt: minutesAgoIso(46),
  },
  {
    id: "issue-broken-edge-link",
    severity: "low",
    category: "broken_connections",
    title: "Telemetry edge missing for one integration",
    description: "Monitoring does not receive latency telemetry for one partner endpoint. Edge is unlinked.",
    affectedModuleIds: ["monitoring", "partners-http"],
    relatedEdgeIds: ["e-monitoring-partners"],
    suggestedFixes: ["Attach client-side tracing middleware.", "Enable partner latency exporter."],
    actions: ["view_details", "fix_now", "mark_resolved"],
    lastDetectedAt: minutesAgoIso(82),
  },
];

async function simulateFix(message: string): Promise<RepairResult> {
  // Keep mock deterministic-ish but visually responsive.
  await new Promise((r) => setTimeout(r, 750));
  await new Promise((r) => setTimeout(r, 650));
  return { ok: true, message };
}

export const REPAIR_HANDLERS_MOCK: RepairHandlerRegistry = {
  timeouts: async ({ issue }) => simulateFix(`Applied safe backoff + queued retry for: ${issue.title}`),
  missing_configs: async ({ issue }) => simulateFix(`Opened a guided config checklist for: ${issue.title}`),
  failing_jobs: async ({ issue }) => simulateFix(`Scheduled a retry run for: ${issue.title}`),
  broken_connections: async ({ issue }) => simulateFix(`Queued a telemetry relink workflow for: ${issue.title}`),
  api_errors: async ({ issue }) => simulateFix(`Ran API error triage steps for: ${issue.title}`),
};

export const REPAIR_STEPS_MOCK: Record<string, { title: string; steps: { id: string; title: string; description: string }[] }> =
  {
    "issue-crm-timeouts": {
      title: "CRM timeout remediation",
      steps: [
        { id: "s1", title: "Confirm partner health", description: "Check partner status + latency dashboard." },
        { id: "s2", title: "Reduce batch size", description: "Lower /sync batch size to reduce request time." },
        { id: "s3", title: "Retry queued jobs", description: "Re-run last failed sync batch with backoff." },
      ],
    },
    "issue-missing-webhook-secret": {
      title: "Webhook secret checklist",
      steps: [
        { id: "s1", title: "Locate missing secret", description: "Identify webhook route missing signing secret." },
        { id: "s2", title: "Rotate & set secret", description: "Set WEBHOOK_SIGNING_SECRET and rotate if needed." },
        { id: "s3", title: "Validate inbound signature", description: "Send test webhook and confirm accepted." },
      ],
    },
  };

export function getWorkflowRegistryMock() {
  return WORKFLOW_REGISTRY_MOCK;
}

export function getDiagnosticsMock() {
  return DIAGNOSTICS_ISSUES_MOCK;
}

export function getRepairHandlersMock() {
  return REPAIR_HANDLERS_MOCK;
}

export function getRepairStepsMock(issueId: string) {
  return REPAIR_STEPS_MOCK[issueId];
}

export function getMockNextUpdateIso() {
  return minutesFromNowIso(5);
}

