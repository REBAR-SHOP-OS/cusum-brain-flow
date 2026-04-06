/**
 * Full system architecture — 6 layers, ~50 nodes, all edges.
 * Used by the Architecture page for the interactive multi-layer canvas.
 */
import type { LucideIcon } from "lucide-react";
import {
  Users, Webhook, Database, Globe, Bell, Shield, Router, Bot,
  Briefcase, Factory, UsersRound, Calculator, Search, Video, Mail, MessageSquare,
  Mic, GitBranch, Cpu, Swords, Clapperboard, Brain,
  Share2, CreditCard, Phone, MailOpen, Building2, BookOpen, FileSearch,
  Zap, Timer, KeyRound, Maximize,
  Instagram, DollarSign, PhoneCall, Chrome, Boxes, Receipt, Sparkles,
} from "lucide-react";

export type ArchLayer = "entry" | "auth" | "modules" | "ai" | "backend" | "external";

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
}

/* ───── Layer metadata ───── */
export const LAYERS: { key: ArchLayer; label: string; accent: Accent; y: number }[] = [
  { key: "entry",    label: "Entry Points",      accent: "cyan",    y: 0 },
  { key: "auth",     label: "Auth & Routing",     accent: "emerald", y: 1 },
  { key: "modules",  label: "Core Modules",       accent: "orange",  y: 2 },
  { key: "ai",       label: "AI & Automation",    accent: "violet",  y: 3 },
  { key: "backend",  label: "Edge Functions",     accent: "blue",    y: 4 },
  { key: "external", label: "External Services",  accent: "rose",    y: 5 },
];

/* ───── Nodes ───── */
export const ARCH_NODES: ArchNode[] = [
  // Layer 1: Entry Points
  { id: "web-app",   label: "Web App",    hint: "React SPA",    layer: "entry", accent: "cyan", icon: Globe,    detail: { title: "Web Application", bullets: ["React 18 + Vite 5 + TailwindCSS", "src/App.tsx — main router", "PWA enabled via vite-plugin-pwa"] } },
  { id: "webhooks",  label: "Webhooks",   hint: "Inbound HTTP", layer: "entry", accent: "cyan", icon: Webhook,  detail: { title: "Webhook Endpoints", bullets: ["RingCentral webhook: supabase/functions/ringcentral-webhook/", "Stripe webhook: supabase/functions/stripe-webhook/", "Generic inbound: supabase/functions/webhook-handler/"] } },
  { id: "crons",     label: "Crons",      hint: "Scheduled",    layer: "entry", accent: "cyan", icon: Timer,    detail: { title: "Scheduled Jobs", bullets: ["pg_cron → ringcentral-sync (every 15 min)", "pg_cron → qb-sync (hourly)", "pg_cron → seo-audit (daily)"] } },
  { id: "oauth",     label: "OAuth",      hint: "3rd-party",    layer: "entry", accent: "cyan", icon: KeyRound, detail: { title: "OAuth Flows", bullets: ["QuickBooks OAuth2: supabase/functions/qb-auth/", "Google OAuth: supabase/functions/google-auth/", "Meta OAuth: supabase/functions/meta-auth/"] } },
  { id: "kiosk",     label: "Kiosk",      hint: "TimeClock",    layer: "entry", accent: "cyan", icon: Maximize, detail: { title: "Kiosk Mode", bullets: ["src/pages/TimeClock.tsx — QR/PIN entry", "Auto-sleep after 3 min idle", "Dedicated ai@rebar.shop account"] } },

  // Layer 2: Auth & Routing
  { id: "auth",       label: "Auth",       hint: "Supabase Auth", layer: "auth", accent: "emerald", icon: Shield, detail: { title: "Authentication", bullets: ["src/lib/auth.tsx — signIn, signUp, onAuthStateChange", "Email whitelist: src/lib/accessPolicies.ts", "Auto sign-out for unauthorized sessions"] } },
  { id: "role-guard", label: "RoleGuard",  hint: "RBAC",          layer: "auth", accent: "emerald", icon: Router, detail: { title: "Role-Based Access Control", bullets: ["src/components/RoleGuard.tsx — route protection", "Role-based nav: AppSidebar.tsx", "ProtectedRoute email whitelist check"] } },
  { id: "agent-rtr",  label: "Agent Router", hint: "AI dispatch",  layer: "auth", accent: "emerald", icon: Bot,   detail: { title: "Agent Router", bullets: ["Routes requests to correct AI agent", "Agent registry: agents table", "Action logging: agent_action_log table"] } },

  // Layer 3: Core Modules
  { id: "crm",        label: "CRM",        hint: "Leads & deals",  layer: "modules", accent: "orange", icon: Briefcase,   detail: { title: "CRM Module", bullets: ["src/pages/CRM.tsx — pipeline board", "Leads, contacts, customers tables", "Activity tracking: activity_events"] } },
  { id: "shop-floor", label: "Shop Floor", hint: "Production",     layer: "modules", accent: "orange", icon: Factory,     detail: { title: "Shop Floor", bullets: ["src/pages/ShopFloor.tsx — live production", "Work orders, cut batches, bend batches", "Machine monitoring: machines table"] } },
  { id: "team-hub",   label: "Team Hub",   hint: "HR & time",      layer: "modules", accent: "orange", icon: UsersRound,  detail: { title: "Team Hub", bullets: ["src/pages/TeamHub.tsx — employee management", "Time entries, schedules, attendance", "Performance tracking"] } },
  { id: "accounting", label: "Accounting", hint: "Finance",        layer: "modules", accent: "orange", icon: Calculator,  detail: { title: "Accounting", bullets: ["src/pages/Accounting.tsx — financial overview", "QuickBooks mirror: accounting_mirror table", "Budgets, CCA schedules, bank feeds"] } },
  { id: "seo",        label: "SEO",        hint: "Rankings",       layer: "modules", accent: "orange", icon: Search,      detail: { title: "SEO Module", bullets: ["src/pages/SeoHub.tsx — keyword tracking", "Site audits, backlink monitoring", "Google Search Console integration"] } },
  { id: "video",      label: "Video",      hint: "Ad Director",    layer: "modules", accent: "orange", icon: Video,       detail: { title: "Video Ad Director", bullets: ["src/pages/AdDirector.tsx — AI video creation", "Storyboard → script → clips workflow", "Brand kit integration"] } },
  { id: "email",      label: "Email",      hint: "Campaigns",      layer: "modules", accent: "orange", icon: Mail,        detail: { title: "Email Campaigns", bullets: ["Campaign builder with templates", "Audience segmentation", "Delivery tracking via alert_dispatch_log"] } },
  { id: "chat",       label: "Chat",       hint: "Messaging",      layer: "modules", accent: "orange", icon: MessageSquare, detail: { title: "Chat System", bullets: ["src/components/chat/ — thread-based", "chat_threads, chat_thread_messages tables", "Real-time via Supabase Realtime"] } },

  // Layer 4: AI & Automation
  { id: "vizzy",      label: "Vizzy",      hint: "Voice AI",       layer: "ai", accent: "violet", icon: Mic,          detail: { title: "Vizzy — Voice Assistant", bullets: ["src/hooks/useVoiceEngine.ts — WebRTC Realtime", "OpenAI Realtime API with sliding window", "ERP data digest for context"] } },
  { id: "pipeline",   label: "Pipeline",   hint: "Workflows",      layer: "ai", accent: "violet", icon: GitBranch,    detail: { title: "Automation Pipeline", bullets: ["automation_configs table — workflow definitions", "automation_runs table — execution log", "Trigger types: cron, webhook, manual"] } },
  { id: "autopilot",  label: "Autopilot",  hint: "Auto-actions",   layer: "ai", accent: "violet", icon: Cpu,          detail: { title: "Autopilot System", bullets: ["autopilot_runs — plan → simulate → execute", "Risk policies: autopilot_risk_policies", "Protected models: autopilot_protected_models"] } },
  { id: "qa-war",     label: "QA War",     hint: "Quality",        layer: "ai", accent: "violet", icon: Swords,       detail: { title: "QA War Room", bullets: ["Barlist verification pipeline", "OCR confidence scoring", "Auto-approval workflows"] } },
  { id: "ad-director", label: "Ad Director", hint: "Creative AI",  layer: "ai", accent: "violet", icon: Clapperboard, detail: { title: "AI Ad Director", bullets: ["Script generation with brand kit", "Storyboard AI: scene planning", "Segment-based video assembly"] } },
  { id: "nila",       label: "Nila",       hint: "Chat AI",        layer: "ai", accent: "violet", icon: Brain,        detail: { title: "Nila — AI Chat Agent", bullets: ["chat_sessions, chat_messages tables", "Multi-agent support (agent_name)", "Context-aware ERP responses"] } },

  // Layer 5: Edge Functions (Backend)
  { id: "fn-social",   label: "Social",    hint: "Publish",        layer: "backend", accent: "blue", icon: Share2,     detail: { title: "Social Publish", bullets: ["supabase/functions/social-publish/", "Meta Graph API integration", "Multi-platform scheduling"] } },
  { id: "fn-stripe",   label: "Stripe",    hint: "Payments",       layer: "backend", accent: "blue", icon: CreditCard, detail: { title: "Stripe Integration", bullets: ["supabase/functions/stripe-payment/", "supabase/functions/stripe-webhook/", "Invoice & subscription management"] } },
  { id: "fn-ring",     label: "RingCentral", hint: "Telephony",    layer: "backend", accent: "blue", icon: Phone,      detail: { title: "RingCentral Sync", bullets: ["supabase/functions/ringcentral-sync/", "supabase/functions/ringcentral-webhook/", "Call log sync every 15 min"] } },
  { id: "fn-gmail",    label: "Gmail",     hint: "Email API",      layer: "backend", accent: "blue", icon: MailOpen,   detail: { title: "Gmail Integration", bullets: ["supabase/functions/gmail-*/", "Email send & receive", "Thread tracking"] } },
  { id: "fn-odoo",     label: "Odoo",      hint: "ERP sync",       layer: "backend", accent: "blue", icon: Building2,  detail: { title: "Odoo Integration", bullets: ["supabase/functions/odoo-*/", "Product & inventory sync", "Order management bridge"] } },
  { id: "fn-qb",       label: "QuickBooks", hint: "Accounting",    layer: "backend", accent: "blue", icon: BookOpen,   detail: { title: "QuickBooks Sync", bullets: ["supabase/functions/qb-*/", "Customer & invoice mirroring", "OAuth2 token refresh flow"] } },
  { id: "fn-seo",      label: "SEO Engine", hint: "Audit",         layer: "backend", accent: "blue", icon: FileSearch, detail: { title: "SEO Backend", bullets: ["supabase/functions/seo-*/", "PageSpeed & Core Web Vitals", "Keyword rank tracking"] } },
  { id: "fn-ai",       label: "AI Gateway", hint: "LLM proxy",     layer: "backend", accent: "blue", icon: Zap,        detail: { title: "AI Gateway", bullets: ["supabase/functions/ai-*/", "Multi-model routing (OpenAI, Gemini)", "Usage logging: ai_execution_log"] } },
  { id: "fn-push",     label: "Push",      hint: "Notifications",  layer: "backend", accent: "blue", icon: Bell,       detail: { title: "Push Notifications", bullets: ["supabase/functions/push-on-notify/", "supabase/functions/send-push/", "DB trigger → Edge Function pipeline"] } },

  // Layer 6: External Services
  { id: "ext-meta",    label: "Meta",      hint: "FB & IG",        layer: "external", accent: "rose", icon: Instagram,   detail: { title: "Meta Platform", bullets: ["Facebook Graph API", "Instagram Business API", "Ad campaign management"] } },
  { id: "ext-stripe",  label: "Stripe",    hint: "Payments",       layer: "external", accent: "rose", icon: DollarSign,  detail: { title: "Stripe", bullets: ["Payment processing", "Subscription billing", "Webhook events"] } },
  { id: "ext-rc",      label: "RingCentral", hint: "VoIP",         layer: "external", accent: "rose", icon: PhoneCall,   detail: { title: "RingCentral", bullets: ["Voice & SMS API", "Call recording", "WebRTC integration"] } },
  { id: "ext-google",  label: "Google",    hint: "Suite",          layer: "external", accent: "rose", icon: Chrome,      detail: { title: "Google Services", bullets: ["Gmail API", "Search Console", "OAuth2 provider"] } },
  { id: "ext-odoo",    label: "Odoo",      hint: "ERP",            layer: "external", accent: "rose", icon: Boxes,       detail: { title: "Odoo ERP", bullets: ["XML-RPC API", "Inventory & manufacturing", "Product catalog sync"] } },
  { id: "ext-qb",      label: "QuickBooks", hint: "Intuit",       layer: "external", accent: "rose", icon: Receipt,     detail: { title: "QuickBooks Online", bullets: ["REST API v3", "Customer & invoice sync", "OAuth2 authentication"] } },
  { id: "ext-openai",  label: "OpenAI",    hint: "GPT & Realtime", layer: "external", accent: "rose", icon: Sparkles,    detail: { title: "OpenAI", bullets: ["GPT-4o for chat & reasoning", "Realtime API for Vizzy voice", "Embeddings & moderation"] } },
];

/* ───── Edges — define data flow between layers ───── */
export const ARCH_EDGES: ArchEdge[] = [
  // Entry → Auth
  { id: "e1", source: "web-app",  target: "auth" },
  { id: "e2", source: "webhooks", target: "agent-rtr" },
  { id: "e3", source: "crons",    target: "agent-rtr" },
  { id: "e4", source: "oauth",    target: "auth" },
  { id: "e5", source: "kiosk",    target: "auth" },

  // Auth → Modules
  { id: "e6",  source: "auth",       target: "crm" },
  { id: "e7",  source: "auth",       target: "shop-floor" },
  { id: "e8",  source: "auth",       target: "team-hub" },
  { id: "e9",  source: "auth",       target: "accounting" },
  { id: "e10", source: "role-guard", target: "seo" },
  { id: "e11", source: "role-guard", target: "video" },
  { id: "e12", source: "role-guard", target: "email" },
  { id: "e13", source: "role-guard", target: "chat" },
  { id: "e14", source: "auth",       target: "role-guard" },
  { id: "e15", source: "agent-rtr",  target: "role-guard" },

  // Modules → AI
  { id: "e20", source: "crm",        target: "pipeline" },
  { id: "e21", source: "shop-floor", target: "qa-war" },
  { id: "e22", source: "team-hub",   target: "vizzy" },
  { id: "e23", source: "accounting", target: "autopilot" },
  { id: "e24", source: "video",      target: "ad-director" },
  { id: "e25", source: "chat",       target: "nila" },
  { id: "e26", source: "crm",        target: "vizzy" },

  // AI → Backend
  { id: "e30", source: "pipeline",    target: "fn-social" },
  { id: "e31", source: "pipeline",    target: "fn-stripe" },
  { id: "e32", source: "vizzy",       target: "fn-ai" },
  { id: "e33", source: "autopilot",   target: "fn-qb" },
  { id: "e34", source: "autopilot",   target: "fn-odoo" },
  { id: "e35", source: "nila",        target: "fn-ai" },
  { id: "e36", source: "ad-director", target: "fn-ai" },
  { id: "e37", source: "qa-war",      target: "fn-push" },
  { id: "e38", source: "pipeline",    target: "fn-ring" },
  { id: "e39", source: "pipeline",    target: "fn-gmail" },
  { id: "e40", source: "pipeline",    target: "fn-seo" },

  // Backend → External
  { id: "e50", source: "fn-social",  target: "ext-meta" },
  { id: "e51", source: "fn-stripe",  target: "ext-stripe" },
  { id: "e52", source: "fn-ring",    target: "ext-rc" },
  { id: "e53", source: "fn-gmail",   target: "ext-google" },
  { id: "e54", source: "fn-odoo",    target: "ext-odoo" },
  { id: "e55", source: "fn-qb",      target: "ext-qb" },
  { id: "e56", source: "fn-ai",      target: "ext-openai" },
  { id: "e57", source: "fn-seo",     target: "ext-google" },
  { id: "e58", source: "fn-push",    target: "ext-google" },
];

/* ───── Helpers ───── */
export function nodesInLayer(layer: ArchLayer): ArchNode[] {
  return ARCH_NODES.filter((n) => n.layer === layer);
}

export const LAYER_LABELS: Record<ArchLayer, string> = {
  entry: "Entry Points",
  auth: "Auth & Routing",
  modules: "Core Modules",
  ai: "AI & Automation",
  backend: "Edge Functions",
  external: "External Services",
};
