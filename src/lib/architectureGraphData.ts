/**
 * Full system architecture — 7 layers, ~65 nodes, ~70 edges with styles & labels.
 * ADHD-proof: hub-based routing, 3 edge styles, micro-labels.
 */
import type { LucideIcon } from "lucide-react";
import {
  Users, Webhook, Database, Globe, Bell, Shield, Router, Bot,
  Briefcase, Factory, UsersRound, Calculator, Search, Video, Mail, MessageSquare,
  Mic, GitBranch, Cpu, Swords, Clapperboard, Brain,
  Share2, CreditCard, Phone, MailOpen, Building2, BookOpen, FileSearch,
  Zap, Timer, KeyRound, Maximize,
  Instagram, DollarSign, PhoneCall, Chrome, Boxes, Receipt, Sparkles,
  HardDrive, Archive, Activity, ServerCrash, Rocket, Lock, DownloadCloud, MonitorCheck,
  RefreshCw, AlertTriangle, CheckCircle, Workflow, Scale, Server,
  MemoryStick, Radio, Gauge, Key, BarChart3, FileText, HeartPulse, ToggleRight, Bus,
} from "lucide-react";

export type ArchLayer = "entry" | "auth" | "modules" | "ai" | "backend" | "external" | "platform";

export type Accent = "cyan" | "emerald" | "orange" | "violet" | "blue" | "rose";

export interface ArchNode {
  id: string;
  label: string;
  hint: string;
  layer: ArchLayer;
  accent: Accent;
  icon: LucideIcon;
  detail: { title: string; bullets: string[] };
}

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  edgeStyle?: "solid" | "dashed" | "failure";
  label?: string;
}

/* ───── Layer metadata ───── */
export const LAYERS: { key: ArchLayer; label: string; accent: Accent; y: number }[] = [
  { key: "entry",    label: "Entry Points",       accent: "cyan",    y: 0 },
  { key: "auth",     label: "Access Control",     accent: "emerald", y: 1 },
  { key: "modules",  label: "Business Modules",   accent: "orange",  y: 2 },
  { key: "ai",       label: "AI / Automation",     accent: "violet",  y: 3 },
  { key: "backend",  label: "Integrations",       accent: "blue",    y: 4 },
  { key: "external", label: "External Services",  accent: "rose",    y: 5 },
  { key: "platform", label: "Data + Platform",    accent: "emerald", y: 6 },
];

/* ───── Nodes ───── */
export const ARCH_NODES: ArchNode[] = [
  // Layer 1: Entry Points
  { id: "web-app",   label: "Web App",    hint: "React SPA",    layer: "entry", accent: "cyan", icon: Globe,    detail: { title: "Web Application", bullets: ["React 18 + Vite 5 + TailwindCSS", "src/App.tsx — main router", "PWA enabled via vite-plugin-pwa"] } },
  { id: "webhooks",  label: "Webhooks",   hint: "Inbound HTTP", layer: "entry", accent: "cyan", icon: Webhook,  detail: { title: "Webhook Endpoints", bullets: ["RingCentral webhook", "Stripe webhook", "Generic inbound handler"] } },
  { id: "crons",     label: "Crons",      hint: "Scheduled",    layer: "entry", accent: "cyan", icon: Timer,    detail: { title: "Scheduled Jobs", bullets: ["pg_cron → ringcentral-sync (15 min)", "pg_cron → qb-sync (hourly)", "pg_cron → seo-audit (daily)"] } },
  { id: "oauth",     label: "OAuth",      hint: "3rd-party",    layer: "entry", accent: "cyan", icon: KeyRound, detail: { title: "OAuth Flows", bullets: ["QuickBooks OAuth2", "Google OAuth", "Meta OAuth"] } },
  { id: "kiosk",     label: "Kiosk",      hint: "TimeClock",    layer: "entry", accent: "cyan", icon: Maximize, detail: { title: "Kiosk Mode", bullets: ["QR/PIN entry", "Auto-sleep after 3 min", "Dedicated kiosk account"] } },

  // Layer 2: Access Control
  { id: "api-gw",    label: "API Gateway", hint: "Hub",           layer: "auth", accent: "emerald", icon: Server,  detail: { title: "API Gateway", bullets: ["Central request hub", "Rate limiting & throttle", "Request routing to services"] } },
  { id: "auth",      label: "Auth",        hint: "Supabase Auth", layer: "auth", accent: "emerald", icon: Shield,  detail: { title: "Authentication", bullets: ["Email whitelist enforcement", "Session management", "Auto sign-out for unauthorized"] } },
  { id: "role-guard", label: "RoleGuard",  hint: "RBAC",          layer: "auth", accent: "emerald", icon: Router,  detail: { title: "Role-Based Access Control", bullets: ["Route protection", "Role-based navigation", "Email whitelist check"] } },
  { id: "agent-rtr", label: "Agent Router", hint: "AI dispatch",  layer: "auth", accent: "emerald", icon: Bot,     detail: { title: "Agent Router", bullets: ["Routes to correct AI agent", "Agent registry", "Action logging"] } },

  // Layer 3: Business Modules
  { id: "crm",        label: "CRM",        hint: "Leads & deals",  layer: "modules", accent: "orange", icon: Briefcase,   detail: { title: "CRM Module", bullets: ["Pipeline board", "Leads, contacts, customers", "Activity tracking"] } },
  { id: "shop-floor", label: "Shop Floor", hint: "Production",     layer: "modules", accent: "orange", icon: Factory,     detail: { title: "Shop Floor", bullets: ["Live production dashboard", "Work orders, cut & bend batches", "Machine monitoring"] } },
  { id: "team-hub",   label: "Team Hub",   hint: "HR & time",      layer: "modules", accent: "orange", icon: UsersRound,  detail: { title: "Team Hub", bullets: ["Employee management", "Time entries & schedules", "Performance tracking"] } },
  { id: "accounting", label: "Accounting", hint: "Finance",        layer: "modules", accent: "orange", icon: Calculator,  detail: { title: "Accounting", bullets: ["Financial overview", "QuickBooks mirror", "Budgets & bank feeds"] } },
  { id: "seo",        label: "SEO",        hint: "Rankings",       layer: "modules", accent: "orange", icon: Search,      detail: { title: "SEO Module", bullets: ["Keyword tracking", "Site audits", "Search Console integration"] } },
  { id: "video",      label: "Video",      hint: "Ad Director",    layer: "modules", accent: "orange", icon: Video,       detail: { title: "Video Ad Director", bullets: ["AI video creation", "Storyboard workflow", "Brand kit integration"] } },
  { id: "email",      label: "Email",      hint: "Campaigns",      layer: "modules", accent: "orange", icon: Mail,        detail: { title: "Email Campaigns", bullets: ["Template builder", "Audience segmentation", "Delivery tracking"] } },
  { id: "chat",       label: "Chat",       hint: "Messaging",      layer: "modules", accent: "orange", icon: MessageSquare, detail: { title: "Chat System", bullets: ["Thread-based messaging", "Real-time via Supabase Realtime", "File sharing"] } },

  // Layer 4: AI & Automation
  { id: "vizzy",       label: "Vizzy",       hint: "Voice AI",       layer: "ai", accent: "violet", icon: Mic,          detail: { title: "Vizzy — Voice Assistant", bullets: ["WebRTC Realtime", "Sliding window context", "ERP data digest"] } },
  { id: "pipeline",    label: "Pipeline",    hint: "Workflows",      layer: "ai", accent: "violet", icon: GitBranch,    detail: { title: "Automation Pipeline", bullets: ["Workflow definitions", "Execution log", "Cron, webhook, manual triggers"] } },
  { id: "autopilot",   label: "Autopilot",   hint: "Auto-actions",   layer: "ai", accent: "violet", icon: Cpu,          detail: { title: "Autopilot System", bullets: ["Plan → simulate → execute", "Risk policies", "Protected models"] } },
  { id: "qa-war",      label: "QA War",      hint: "Quality",        layer: "ai", accent: "violet", icon: Swords,       detail: { title: "QA War Room", bullets: ["Barlist verification", "OCR confidence scoring", "Auto-approval workflows"] } },
  { id: "ad-director", label: "Ad Director", hint: "Creative AI",    layer: "ai", accent: "violet", icon: Clapperboard, detail: { title: "AI Ad Director", bullets: ["Script generation", "Scene planning", "Video assembly"] } },
  { id: "nila",        label: "Nila",        hint: "Chat AI",        layer: "ai", accent: "violet", icon: Brain,        detail: { title: "Nila — AI Chat Agent", bullets: ["Multi-agent support", "Context-aware responses", "ERP integration"] } },
  { id: "approval-eng", label: "Approval",   hint: "Approvals",      layer: "ai", accent: "violet", icon: CheckCircle,  detail: { title: "Approval Engine", bullets: ["Multi-step approval flows", "Role-based approval chains", "Audit trail logging"] } },
  { id: "state-machine", label: "State Machine", hint: "Workflows",  layer: "ai", accent: "violet", icon: Workflow,     detail: { title: "State Machine", bullets: ["Draft → Review → Approved → Complete", "Failed → Retry → Dead Letter", "Configurable transitions"] } },
  { id: "rules-engine", label: "Rules Engine", hint: "Business rules", layer: "ai", accent: "violet", icon: Scale,      detail: { title: "Rules Engine", bullets: ["Conditional logic execution", "Threshold-based triggers", "Dynamic rule evaluation"] } },

  // Layer 5: Integrations (Edge Functions)
  { id: "fn-social",   label: "Social",     hint: "Publish",        layer: "backend", accent: "blue", icon: Share2,     detail: { title: "Social Publish", bullets: ["Meta Graph API", "Multi-platform scheduling", "Content queue"] } },
  { id: "fn-stripe",   label: "Stripe",     hint: "Payments",       layer: "backend", accent: "blue", icon: CreditCard, detail: { title: "Stripe Integration", bullets: ["Payment processing", "Webhook handling", "Invoice management"] } },
  { id: "fn-ring",     label: "RingCentral", hint: "Telephony",     layer: "backend", accent: "blue", icon: Phone,      detail: { title: "RingCentral Sync", bullets: ["Call log sync", "Webhook events", "SMS integration"] } },
  { id: "fn-gmail",    label: "Gmail",      hint: "Email API",      layer: "backend", accent: "blue", icon: MailOpen,   detail: { title: "Gmail Integration", bullets: ["Email send & receive", "Thread tracking", "Draft management"] } },
  { id: "fn-odoo",     label: "Odoo",       hint: "ERP sync",       layer: "backend", accent: "blue", icon: Building2,  detail: { title: "Odoo Integration", bullets: ["Product & inventory sync", "Order management", "XML-RPC bridge"] } },
  { id: "fn-qb",       label: "QuickBooks", hint: "Accounting",     layer: "backend", accent: "blue", icon: BookOpen,   detail: { title: "QuickBooks Sync", bullets: ["Customer & invoice mirroring", "OAuth2 token refresh", "Balance sync"] } },
  { id: "fn-seo",      label: "SEO Engine", hint: "Audit",          layer: "backend", accent: "blue", icon: FileSearch, detail: { title: "SEO Backend", bullets: ["PageSpeed analysis", "Core Web Vitals", "Keyword tracking"] } },
  { id: "fn-ai",       label: "AI Gateway", hint: "LLM proxy",      layer: "backend", accent: "blue", icon: Zap,        detail: { title: "AI Gateway", bullets: ["Multi-model routing", "Usage logging", "Rate limiting"] } },
  { id: "fn-push",     label: "Push",       hint: "Notifications",  layer: "backend", accent: "blue", icon: Bell,       detail: { title: "Push Notifications", bullets: ["DB trigger pipeline", "Multi-channel delivery", "Escalation rules"] } },

  // Layer 6: External Services
  { id: "ext-meta",    label: "Meta",       hint: "FB & IG",        layer: "external", accent: "rose", icon: Instagram,   detail: { title: "Meta Platform", bullets: ["Facebook Graph API", "Instagram Business API", "Ad campaigns"] } },
  { id: "ext-stripe",  label: "Stripe",     hint: "Payments",       layer: "external", accent: "rose", icon: DollarSign,  detail: { title: "Stripe", bullets: ["Payment processing", "Subscription billing", "Webhook events"] } },
  { id: "ext-rc",      label: "RingCentral", hint: "VoIP",          layer: "external", accent: "rose", icon: PhoneCall,   detail: { title: "RingCentral", bullets: ["Voice & SMS API", "Call recording", "WebRTC"] } },
  { id: "ext-google",  label: "Google",     hint: "Suite",          layer: "external", accent: "rose", icon: Chrome,      detail: { title: "Google Services", bullets: ["Gmail API", "Search Console", "OAuth2"] } },
  { id: "ext-odoo",    label: "Odoo",       hint: "ERP",            layer: "external", accent: "rose", icon: Boxes,       detail: { title: "Odoo ERP", bullets: ["XML-RPC API", "Inventory", "Product catalog"] } },
  { id: "ext-qb",      label: "QuickBooks", hint: "Intuit",         layer: "external", accent: "rose", icon: Receipt,     detail: { title: "QuickBooks Online", bullets: ["REST API v3", "Invoice sync", "OAuth2"] } },
  { id: "ext-openai",  label: "OpenAI",     hint: "GPT & Realtime", layer: "external", accent: "rose", icon: Sparkles,    detail: { title: "OpenAI", bullets: ["GPT-4o", "Realtime API", "Embeddings"] } },

  // Layer 7: Data + Platform
  { id: "primary-db",    label: "Primary DB",    hint: "PostgreSQL",   layer: "platform", accent: "emerald", icon: Database,      detail: { title: "Primary Database", bullets: ["Supabase PostgreSQL", "RLS policies", "Source of truth"] } },
  { id: "obj-storage",   label: "Storage",       hint: "Files & media", layer: "platform", accent: "emerald", icon: Archive,       detail: { title: "Object Storage", bullets: ["Supabase Storage", "Media uploads", "CDN delivery"] } },
  { id: "redis-cache",   label: "Redis Cache",   hint: "Fast reads",   layer: "platform", accent: "emerald", icon: Zap,           detail: { title: "Redis Cache", bullets: ["Session cache", "Rate limit counters", "Hot data"] } },
  { id: "search-idx",    label: "Search Index",  hint: "Full-text",    layer: "platform", accent: "emerald", icon: Search,        detail: { title: "Search Index", bullets: ["Full-text search", "Faceted filtering", "Relevance ranking"] } },
  { id: "event-log",     label: "Event Log",     hint: "Audit trail",  layer: "platform", accent: "emerald", icon: Activity,      detail: { title: "Event Log", bullets: ["activity_events table", "All system actions", "Compliance audit"] } },
  { id: "job-queue",     label: "Job Queue",     hint: "Async hub",    layer: "platform", accent: "emerald", icon: GitBranch,     detail: { title: "Job Queue", bullets: ["Async task dispatch", "Priority scheduling", "Retry policies"] } },
  { id: "worker-pool",   label: "Worker Pool",   hint: "Executors",    layer: "platform", accent: "emerald", icon: Cpu,           detail: { title: "Worker Pool", bullets: ["Edge function workers", "Concurrent execution", "Auto-scaling"] } },
  { id: "retry-queue",   label: "Retry Queue",   hint: "Retries",      layer: "platform", accent: "emerald", icon: RefreshCw,     detail: { title: "Retry Queue", bullets: ["Exponential backoff", "Max retry limits", "Failure routing"] } },
  { id: "dlq",           label: "Dead Letter",   hint: "Failed jobs",  layer: "platform", accent: "emerald", icon: AlertTriangle, detail: { title: "Dead Letter Queue", bullets: ["Permanently failed jobs", "Manual review", "Alert triggers"] } },
  { id: "monitoring",    label: "Monitoring",    hint: "Observability", layer: "platform", accent: "emerald", icon: MonitorCheck,  detail: { title: "Monitoring", bullets: ["Prometheus metrics", "Grafana dashboards", "Alerting rules"] } },
  { id: "error-track",   label: "Error Track",   hint: "Errors",       layer: "platform", accent: "emerald", icon: ServerCrash,   detail: { title: "Error Tracking", bullets: ["Exception capture", "Stack trace logging", "Error grouping"] } },
  { id: "cicd",          label: "CI/CD",         hint: "Deploy",       layer: "platform", accent: "emerald", icon: Rocket,        detail: { title: "CI/CD Pipeline", bullets: ["Automated builds", "Test suites", "Zero-downtime deploy"] } },
  { id: "secrets-mgr",   label: "Secrets",       hint: "Vault",        layer: "platform", accent: "emerald", icon: Lock,          detail: { title: "Secrets Manager", bullets: ["API key storage", "Token rotation", "Encrypted vault"] } },
  { id: "backups",       label: "Backups",       hint: "Recovery",     layer: "platform", accent: "emerald", icon: DownloadCloud, detail: { title: "Backups", bullets: ["Daily snapshots", "Point-in-time recovery", "Geo-redundant storage"] } },
  { id: "admin-console", label: "Admin",         hint: "Management",   layer: "platform", accent: "emerald", icon: Users,         detail: { title: "Admin Console", bullets: ["User management", "System configuration", "Feature flags"] } },
  { id: "cdn-edge",      label: "CDN / Edge",    hint: "Delivery",     layer: "platform", accent: "emerald", icon: Globe,         detail: { title: "CDN / Edge", bullets: ["Static asset delivery", "Edge caching", "Global distribution"] } },
  { id: "memory-store",  label: "Memory",        hint: "AI & CRM memory", layer: "platform", accent: "emerald", icon: MemoryStick,   detail: { title: "Memory Store", bullets: ["Vizzy brain & lead memory", "Qualification / quote / loss memory", "Client performance memory"] } },
  { id: "realtime",      label: "Realtime",      hint: "Live events",  layer: "platform", accent: "emerald", icon: Radio,         detail: { title: "Realtime Engine", bullets: ["Supabase Realtime", "Live chat & dashboards", "Presence & notifications"] } },
  { id: "rate-limiter",  label: "Rate Limiter",  hint: "Throttle",     layer: "platform", accent: "emerald", icon: Gauge,         detail: { title: "Rate Limiter", bullets: ["Request rate limiting", "Per-user & per-route limits", "Burst protection"] } },
  { id: "session-store", label: "Sessions",      hint: "Auth state",   layer: "platform", accent: "emerald", icon: Key,           detail: { title: "Session Store", bullets: ["Auth session management", "Token storage & rotation", "SSO state"] } },
  { id: "analytics",     label: "Analytics",     hint: "Telemetry",    layer: "platform", accent: "emerald", icon: BarChart3,     detail: { title: "Analytics", bullets: ["Usage metrics", "System telemetry", "AI cost tracking"] } },
  { id: "log-agg",       label: "Log Aggregator", hint: "System logs", layer: "platform", accent: "emerald", icon: FileText,      detail: { title: "Log Aggregator", bullets: ["Centralized log collection", "Structured logging", "Log retention policies"] } },
  { id: "health",        label: "Health Check",  hint: "Uptime",       layer: "platform", accent: "emerald", icon: HeartPulse,    detail: { title: "Health Checks", bullets: ["Endpoint health probes", "Liveness & readiness", "Uptime monitoring"] } },
  { id: "feature-flags", label: "Feature Flags", hint: "Toggles",      layer: "platform", accent: "emerald", icon: ToggleRight,   detail: { title: "Feature Flags", bullets: ["Feature toggles", "Gradual rollouts", "A/B testing gates"] } },
  { id: "msg-bus",       label: "Message Bus",   hint: "Pub/Sub",      layer: "platform", accent: "emerald", icon: Bus,           detail: { title: "Message Bus", bullets: ["Event-driven Pub/Sub", "Inter-service communication", "Async decoupling"] } },
];

/* ───── Edges — hub-based routing, 3 styles, micro-labels ───── */
export const ARCH_EDGES: ArchEdge[] = [
  // Entry → API Gateway (hub)
  { id: "e1",  source: "web-app",  target: "api-gw",  edgeStyle: "solid" },
  { id: "e2",  source: "webhooks", target: "api-gw",  edgeStyle: "dashed", label: "webhook" },
  { id: "e3",  source: "crons",    target: "api-gw",  edgeStyle: "dashed", label: "cron" },
  { id: "e4",  source: "oauth",    target: "api-gw",  edgeStyle: "solid",  label: "auth" },
  { id: "e5",  source: "kiosk",    target: "api-gw",  edgeStyle: "solid" },

  // API Gateway → Auth layer
  { id: "e6",  source: "api-gw",    target: "auth",       edgeStyle: "solid",  label: "auth" },
  { id: "e7",  source: "api-gw",    target: "agent-rtr",  edgeStyle: "solid" },
  { id: "e8",  source: "auth",      target: "role-guard", edgeStyle: "solid" },
  { id: "e9",  source: "agent-rtr", target: "role-guard", edgeStyle: "solid" },

  // Auth → Modules
  { id: "e10", source: "role-guard", target: "crm",        edgeStyle: "solid" },
  { id: "e11", source: "role-guard", target: "shop-floor", edgeStyle: "solid" },
  { id: "e12", source: "role-guard", target: "team-hub",   edgeStyle: "solid" },
  { id: "e13", source: "role-guard", target: "accounting", edgeStyle: "solid" },
  { id: "e14", source: "role-guard", target: "seo",        edgeStyle: "solid" },
  { id: "e15", source: "role-guard", target: "video",      edgeStyle: "solid" },
  { id: "e16", source: "role-guard", target: "email",      edgeStyle: "solid" },
  { id: "e17", source: "role-guard", target: "chat",       edgeStyle: "solid" },

  // Modules → AI
  { id: "e20", source: "crm",        target: "pipeline",      edgeStyle: "solid" },
  { id: "e21", source: "shop-floor", target: "qa-war",        edgeStyle: "solid" },
  { id: "e22", source: "team-hub",   target: "vizzy",         edgeStyle: "solid" },
  { id: "e23", source: "accounting", target: "autopilot",     edgeStyle: "solid",  label: "sync" },
  { id: "e24", source: "video",      target: "ad-director",   edgeStyle: "solid" },
  { id: "e25", source: "chat",       target: "nila",          edgeStyle: "solid" },
  { id: "e26", source: "crm",        target: "vizzy",         edgeStyle: "dashed" },
  { id: "e27", source: "crm",        target: "approval-eng",  edgeStyle: "solid",  label: "approve" },
  { id: "e28", source: "shop-floor", target: "state-machine", edgeStyle: "dashed" },
  { id: "e29", source: "pipeline",   target: "rules-engine",  edgeStyle: "solid" },

  // AI → Integrations (Backend)
  { id: "e30", source: "pipeline",    target: "fn-social",  edgeStyle: "solid",  label: "publish" },
  { id: "e31", source: "pipeline",    target: "fn-stripe",  edgeStyle: "solid" },
  { id: "e32", source: "vizzy",       target: "fn-ai",      edgeStyle: "solid" },
  { id: "e33", source: "autopilot",   target: "fn-qb",      edgeStyle: "solid",  label: "sync" },
  { id: "e34", source: "autopilot",   target: "fn-odoo",    edgeStyle: "solid",  label: "sync" },
  { id: "e35", source: "nila",        target: "fn-ai",      edgeStyle: "solid" },
  { id: "e36", source: "ad-director", target: "fn-ai",      edgeStyle: "solid" },
  { id: "e37", source: "qa-war",      target: "fn-push",    edgeStyle: "dashed", label: "notify" },
  { id: "e38", source: "pipeline",    target: "fn-ring",    edgeStyle: "solid" },
  { id: "e39", source: "pipeline",    target: "fn-gmail",   edgeStyle: "solid" },
  { id: "e40", source: "pipeline",    target: "fn-seo",     edgeStyle: "solid" },
  { id: "e41", source: "approval-eng", target: "fn-push",   edgeStyle: "dashed", label: "notify" },
  { id: "e42", source: "rules-engine", target: "fn-ai",     edgeStyle: "solid" },

  // Integrations → External
  { id: "e50", source: "fn-social",  target: "ext-meta",    edgeStyle: "solid" },
  { id: "e51", source: "fn-stripe",  target: "ext-stripe",  edgeStyle: "solid" },
  { id: "e52", source: "fn-ring",    target: "ext-rc",      edgeStyle: "solid" },
  { id: "e53", source: "fn-gmail",   target: "ext-google",  edgeStyle: "solid" },
  { id: "e54", source: "fn-odoo",    target: "ext-odoo",    edgeStyle: "solid" },
  { id: "e55", source: "fn-qb",      target: "ext-qb",      edgeStyle: "solid" },
  { id: "e56", source: "fn-ai",      target: "ext-openai",  edgeStyle: "solid" },
  { id: "e57", source: "fn-seo",     target: "ext-google",  edgeStyle: "solid",  label: "search" },
  { id: "e58", source: "fn-push",    target: "ext-google",  edgeStyle: "dashed" },

  // Modules / AI → Data + Platform (via hubs)
  { id: "e60", source: "crm",         target: "primary-db",   edgeStyle: "dashed", label: "persist" },
  { id: "e61", source: "shop-floor",  target: "primary-db",   edgeStyle: "dashed", label: "persist" },
  { id: "e62", source: "accounting",  target: "primary-db",   edgeStyle: "dashed" },
  { id: "e63", source: "pipeline",    target: "job-queue",    edgeStyle: "dashed", label: "enqueue" },
  { id: "e64", source: "job-queue",   target: "worker-pool",  edgeStyle: "solid" },
  { id: "e65", source: "worker-pool", target: "retry-queue",  edgeStyle: "failure", label: "fail" },
  { id: "e66", source: "retry-queue", target: "dlq",          edgeStyle: "failure", label: "dead" },
  { id: "e67", source: "retry-queue", target: "worker-pool",  edgeStyle: "failure", label: "retry" },
  { id: "e68", source: "fn-ai",       target: "event-log",    edgeStyle: "dashed", label: "audit" },
  { id: "e69", source: "autopilot",   target: "event-log",    edgeStyle: "dashed", label: "audit" },
  { id: "e70", source: "api-gw",      target: "redis-cache",  edgeStyle: "dashed", label: "cache" },
  { id: "e71", source: "fn-seo",      target: "search-idx",   edgeStyle: "solid",  label: "index" },
  { id: "e72", source: "primary-db",  target: "backups",      edgeStyle: "dashed" },
  { id: "e73", source: "cicd",        target: "worker-pool",  edgeStyle: "solid" },
  { id: "e74", source: "monitoring",  target: "error-track",  edgeStyle: "solid" },
  { id: "e75", source: "cdn-edge",    target: "obj-storage",  edgeStyle: "solid" },
  { id: "e76", source: "state-machine", target: "event-log",  edgeStyle: "dashed", label: "audit" },

  // Memory, Realtime, Infrastructure edges
  { id: "e80", source: "vizzy",         target: "memory-store",  edgeStyle: "dashed", label: "remember" },
  { id: "e81", source: "nila",          target: "memory-store",  edgeStyle: "dashed", label: "remember" },
  { id: "e82", source: "crm",           target: "memory-store",  edgeStyle: "dashed", label: "qualify" },
  { id: "e83", source: "memory-store",  target: "primary-db",    edgeStyle: "solid",  label: "persist" },
  { id: "e84", source: "chat",          target: "realtime",      edgeStyle: "solid",  label: "live" },
  { id: "e85", source: "primary-db",    target: "realtime",      edgeStyle: "dashed", label: "stream" },
  { id: "e86", source: "api-gw",        target: "rate-limiter",  edgeStyle: "solid",  label: "throttle" },
  { id: "e87", source: "auth",          target: "session-store", edgeStyle: "solid",  label: "session" },
  { id: "e88", source: "monitoring",    target: "health",        edgeStyle: "solid" },
  { id: "e89", source: "monitoring",    target: "analytics",     edgeStyle: "solid" },
  { id: "e90", source: "monitoring",    target: "log-agg",       edgeStyle: "solid" },
  { id: "e91", source: "admin-console", target: "feature-flags", edgeStyle: "solid" },
  { id: "e92", source: "pipeline",      target: "msg-bus",       edgeStyle: "dashed", label: "publish" },
  { id: "e93", source: "msg-bus",       target: "worker-pool",   edgeStyle: "solid",  label: "consume" },
];

/* ───── Helpers ───── */
export function nodesInLayer(layer: ArchLayer): ArchNode[] {
  return ARCH_NODES.filter((n) => n.layer === layer);
}

export const LAYER_LABELS: Record<ArchLayer, string> = {
  entry: "Entry Points",
  auth: "Access Control",
  modules: "Business Modules",
  ai: "AI / Automation",
  backend: "Integrations",
  external: "External Services",
  platform: "Data + Platform",
};
