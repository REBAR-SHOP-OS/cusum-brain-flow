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
  Ruler, FileSpreadsheet, Banknote, Inbox, Library, BellRing, Camera, Globe2, Plug, AudioLines,
  TrendingUp, HeadphonesIcon, Megaphone, PenTool, UserSearch, Sprout, Crown, Wrench,
  Truck, MailCheck, Eye, Compass, Palette, GraduationCap,
  LayoutDashboard, ListTodo, Monitor, Building, Star, Clock, Package, Stethoscope, Settings,
} from "lucide-react";

export type ArchLayer = "entry" | "auth" | "ai" | "backend" | "external" | "platform" | "items";

export type Accent = "cyan" | "emerald" | "orange" | "violet" | "blue" | "rose" | "amber";

export interface ArchNode {
  id: string;
  label: string;
  hint: string;
  layer: ArchLayer;
  accent: Accent;
  icon: LucideIcon;
  detail: { title: string; bullets: string[] };
  description?: string;
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
  { key: "external", label: "External Services",  accent: "rose",    y: 0 },
  { key: "items",    label: "System Items",        accent: "orange",  y: 1 },
  { key: "ai",       label: "AI / Automation",    accent: "violet",  y: 2 },
  { key: "backend",  label: "Integrations",       accent: "blue",    y: 3 },
  { key: "auth",     label: "Access Control",     accent: "emerald", y: 4 },
  { key: "entry",    label: "Entry Points",       accent: "cyan",    y: 5 },
  { key: "platform", label: "Data + Platform",    accent: "amber", y: 6 },
];

/* ───── Nodes ───── */
export const ARCH_NODES: ArchNode[] = [
  // Layer 1: Entry Points
  { id: "web-app",   label: "Web App",    hint: "React SPA",    layer: "entry", accent: "cyan", icon: Globe,    detail: { title: "Web Application", bullets: ["React 18 + Vite 5 + TailwindCSS", "src/App.tsx — main router", "PWA enabled via vite-plugin-pwa"] }, description: "Main browser-based single-page application serving all UI modules and dashboards." },
  { id: "webhooks",  label: "Webhooks",   hint: "Inbound HTTP", layer: "entry", accent: "cyan", icon: Webhook,  detail: { title: "Webhook Endpoints", bullets: ["RingCentral webhook", "Stripe webhook", "Generic inbound handler"] }, description: "Receives inbound HTTP callbacks from external services like Stripe, RingCentral, and custom integrations." },
  { id: "crons",     label: "Crons",      hint: "Scheduled",    layer: "entry", accent: "cyan", icon: Timer,    detail: { title: "Scheduled Jobs", bullets: ["pg_cron → ringcentral-sync (15 min)", "pg_cron → qb-sync (hourly)", "pg_cron → seo-audit (daily)"] }, description: "Executes recurring background jobs on defined schedules for data synchronization and maintenance." },
  { id: "oauth",     label: "OAuth",      hint: "3rd-party",    layer: "entry", accent: "cyan", icon: KeyRound, detail: { title: "OAuth Flows", bullets: ["QuickBooks OAuth2", "Google OAuth", "Meta OAuth"] }, description: "Handles third-party OAuth2 authorization flows for connecting external accounts." },
  { id: "kiosk",     label: "Kiosk",      hint: "TimeClock",    layer: "entry", accent: "cyan", icon: Maximize, detail: { title: "Kiosk Mode", bullets: ["QR/PIN entry", "Auto-sleep after 3 min", "Dedicated kiosk account"] }, description: "Dedicated time-clock interface for shop floor employees to punch in/out via QR or PIN." },

  // Layer 2: Access Control
  { id: "api-gw",    label: "API Gateway", hint: "Hub",           layer: "auth", accent: "emerald", icon: Server,  detail: { title: "API Gateway", bullets: ["Central request hub", "Rate limiting & throttle", "Request routing to services"] }, description: "Central request hub that routes, rate-limits, and authenticates all inbound API traffic." },
  { id: "auth",      label: "Auth",        hint: "Supabase Auth", layer: "auth", accent: "emerald", icon: Shield,  detail: { title: "Authentication", bullets: ["Email whitelist enforcement", "Session management", "Auto sign-out for unauthorized"] }, description: "Manages user authentication via email whitelist, session tokens, and automatic sign-out." },
  { id: "role-guard", label: "RoleGuard",  hint: "RBAC",          layer: "auth", accent: "emerald", icon: Router,  detail: { title: "Role-Based Access Control", bullets: ["Route protection", "Role-based navigation", "Email whitelist check"] }, description: "Enforces role-based access control on every route, ensuring users only see authorized modules." },
  { id: "agent-rtr", label: "Agent Router", hint: "AI dispatch",  layer: "auth", accent: "emerald", icon: Bot,     detail: { title: "Agent Router", bullets: ["Routes to correct AI agent", "Agent registry", "Action logging"] }, description: "Dispatches incoming AI requests to the correct specialized agent based on intent classification." },

  // Layer 3: Business Modules
  { id: "crm",        label: "CRM",        hint: "Leads & deals",  layer: "items", accent: "orange", icon: Briefcase,   detail: { title: "CRM Module", bullets: ["Pipeline board", "Leads, contacts, customers", "Activity tracking"] }, description: "Manages the full sales pipeline from lead capture through deal closure and customer management." },
  { id: "shop-floor", label: "Shop Floor", hint: "Production",     layer: "items", accent: "orange", icon: Factory,     detail: { title: "Shop Floor", bullets: ["Live production dashboard", "Work orders, cut & bend batches", "Machine monitoring"] }, description: "Real-time production management with work orders, machine monitoring, and batch tracking." },
  { id: "team-hub",   label: "Team Hub",   hint: "HR & time",      layer: "items", accent: "orange", icon: UsersRound,  detail: { title: "Team Hub", bullets: ["Employee management", "Time entries & schedules", "Performance tracking"] }, description: "HR module for employee management, scheduling, time tracking, and performance reviews." },
  { id: "accounting", label: "Accounting", hint: "Finance",        layer: "items", accent: "orange", icon: Calculator,  detail: { title: "Accounting", bullets: ["Financial overview", "QuickBooks mirror", "Budgets & bank feeds"] }, description: "Financial management with QuickBooks mirroring, budgets, bank feeds, and P&L reporting." },
  { id: "seo",        label: "SEO",        hint: "Rankings",       layer: "items", accent: "orange", icon: Search,      detail: { title: "SEO Module", bullets: ["Keyword tracking", "Site audits", "Search Console integration"] }, description: "Tracks keyword rankings, runs site audits, and integrates with Google Search Console." },
  { id: "video",      label: "Video",      hint: "Ad Director",    layer: "items", accent: "orange", icon: Video,       detail: { title: "Video Ad Director", bullets: ["AI video creation", "Storyboard workflow", "Brand kit integration"] }, description: "AI-powered video ad creation with storyboard workflows and brand kit integration." },
  { id: "email",      label: "Email",      hint: "Campaigns",      layer: "items", accent: "orange", icon: Mail,        detail: { title: "Email Campaigns", bullets: ["Template builder", "Audience segmentation", "Delivery tracking"] }, description: "Email campaign management with template building, audience segmentation, and delivery analytics." },
  { id: "chat",       label: "Chat",       hint: "Messaging",      layer: "items", accent: "orange", icon: MessageSquare, detail: { title: "Chat System", bullets: ["Thread-based messaging", "Real-time via Supabase Realtime", "File sharing"] }, description: "Real-time thread-based messaging system with file sharing and AI-assisted responses." },
  { id: "estimating", label: "Estimating", hint: "OCR + AI",       layer: "items", accent: "orange", icon: Ruler,          detail: { title: "Estimating Engine", bullets: ["PDF extraction & OCR", "AI-powered estimates", "Barlist generation"] }, description: "Extracts rebar data from drawings via OCR and generates AI-powered cost estimates and barlists." },
  { id: "quotes",     label: "Quotes",     hint: "Sales quotes",   layer: "items", accent: "orange", icon: FileSpreadsheet, detail: { title: "Sales Quotes", bullets: ["Quote builder & templates", "Price calculation engine", "Email delivery"] }, description: "Builds and sends sales quotes with templating, price calculations, and payment integration." },
  { id: "payroll",    label: "Payroll",    hint: "Wages",          layer: "items", accent: "orange", icon: Banknote,       detail: { title: "Payroll", bullets: ["Pay period processing", "Deductions & benefits", "Export to accounting"] }, description: "Processes payroll with deductions, benefits, overtime calculations, and accounting export." },
  { id: "inbox",      label: "Inbox",      hint: "Unified comms",  layer: "items", accent: "orange", icon: Inbox,          detail: { title: "Inbox / Comms", bullets: ["Unified email + SMS", "AI triage & drafting", "Translation support"] }, description: "Unified communication hub merging email, SMS, and calls with AI triage and translation." },

  // OFFICE additions
  { id: "dashboard",    label: "Dashboard",      hint: "Overview",      layer: "items", accent: "orange", icon: LayoutDashboard, detail: { title: "Dashboard", bullets: ["Company-wide KPIs", "Real-time metrics", "Widget-based layout"] }, description: "Executive overview dashboard with real-time KPIs, metrics widgets, and live data feeds." },
  { id: "biz-tasks",    label: "Business Tasks", hint: "Task mgmt",    layer: "items", accent: "orange", icon: ListTodo,        detail: { title: "Business Tasks", bullets: ["Task assignment & tracking", "Priority management", "Deadline monitoring"] }, description: "Task management system with assignment, priority queues, and deadline tracking across teams." },
  { id: "live-monitor", label: "Live Monitor",   hint: "Real-time",    layer: "items", accent: "orange", icon: Monitor,         detail: { title: "Live Monitor", bullets: ["Real-time production view", "Machine status tracking", "Alert notifications"] }, description: "Live production monitoring showing machine status, throughput, and alert notifications." },
  { id: "ceo-portal",   label: "CEO Portal",     hint: "Executive",    layer: "items", accent: "orange", icon: Building,        detail: { title: "CEO Portal", bullets: ["Executive dashboard", "Financial summaries", "Strategic overview"] }, description: "Executive portal with financial summaries, strategic KPIs, and cross-department insights." },
  { id: "support",      label: "Support",        hint: "Help desk",    layer: "items", accent: "orange", icon: HeadphonesIcon,  detail: { title: "Support", bullets: ["Ticket management", "Customer issue tracking", "AI-assisted responses"] }, description: "Help desk for customer issue tracking with ticket management and AI-assisted responses." },
  { id: "lead-scoring", label: "Lead Scoring",   hint: "AI scoring",   layer: "items", accent: "orange", icon: Star,            detail: { title: "Lead Scoring", bullets: ["AI-powered lead ranking", "Qualification criteria", "Conversion predictions"] }, description: "AI-powered lead qualification and ranking based on engagement, fit, and conversion probability." },
  { id: "customers",    label: "Customers",      hint: "Directory",    layer: "items", accent: "orange", icon: Users,           detail: { title: "Customers", bullets: ["Customer directory", "Contact management", "Purchase history"] }, description: "Central customer directory with contact management, purchase history, and relationship tracking." },
  { id: "sales",        label: "Sales",          hint: "Revenue",      layer: "items", accent: "orange", icon: DollarSign,      detail: { title: "Sales", bullets: ["Sales pipeline", "Deal tracking", "Revenue reporting"] }, description: "Sales pipeline management with deal tracking, revenue reporting, and AI-assisted outreach." },

  // PRODUCTION additions
  { id: "time-clock",   label: "Time Clock",     hint: "Attendance",   layer: "items", accent: "orange", icon: Clock,           detail: { title: "Time Clock", bullets: ["Clock in/out tracking", "Break management", "Overtime calculations"] }, description: "Employee attendance system with clock in/out, break tracking, and overtime calculations." },
  { id: "office-tools", label: "Office Tools",   hint: "Utilities",    layer: "items", accent: "orange", icon: Wrench,          detail: { title: "Office Tools", bullets: ["AI extract & barlist tools", "Production queue", "Packing slips & tags"] }, description: "Utility tools for barlist extraction, production queue management, and packing slip generation." },

  // LOGISTICS
  { id: "inventory",    label: "Inventory",      hint: "Stock",        layer: "items", accent: "orange", icon: Package,         detail: { title: "Inventory", bullets: ["Stock level tracking", "Material management", "Reorder alerts"] }, description: "Inventory management with stock tracking, material ordering, and low-stock reorder alerts." },

  // QA
  { id: "diagnostics",  label: "Diagnostics",    hint: "System health", layer: "items", accent: "orange", icon: Stethoscope,    detail: { title: "Diagnostics", bullets: ["System health checks", "Performance monitoring", "Error diagnostics"] }, description: "System health monitoring with performance diagnostics, error detection, and uptime tracking." },

  // Layer 4: AI & Automation
  { id: "vizzy",       label: "Vizzy",       hint: "Voice AI",       layer: "ai", accent: "violet", icon: Mic,          detail: { title: "Vizzy — Voice Assistant", bullets: ["WebRTC Realtime", "Sliding window context", "ERP data digest"] }, description: "Real-time voice AI assistant using WebRTC with sliding-window context and full ERP data access." },
  { id: "pipeline",    label: "Pipeline",    hint: "Workflows",      layer: "ai", accent: "violet", icon: GitBranch,    detail: { title: "Automation Pipeline", bullets: ["Workflow definitions", "Execution log", "Cron, webhook, manual triggers"] }, description: "Orchestrates automated workflows with cron, webhook, and manual triggers across the entire system." },
  { id: "autopilot",   label: "Autopilot",   hint: "Auto-actions",   layer: "ai", accent: "violet", icon: Cpu,          detail: { title: "Autopilot System", bullets: ["Plan → simulate → execute", "Risk policies", "Protected models"] }, description: "Autonomous execution engine that plans, simulates, and executes actions with risk-aware policies." },
  { id: "qa-war",      label: "QA War",      hint: "Quality",        layer: "ai", accent: "violet", icon: Swords,       detail: { title: "QA War Room", bullets: ["Barlist verification", "OCR confidence scoring", "Auto-approval workflows"] }, description: "Quality assurance hub for barlist verification, OCR confidence scoring, and automated approvals." },
  { id: "ad-director", label: "Ad Director", hint: "Creative AI",    layer: "ai", accent: "violet", icon: Clapperboard, detail: { title: "AI Ad Director", bullets: ["Script generation", "Scene planning", "Video assembly"] }, description: "AI creative director that generates scripts, plans scenes, and assembles video advertisements." },
  { id: "nila",        label: "Nila",        hint: "Chat AI",        layer: "ai", accent: "violet", icon: Brain,        detail: { title: "Nila — AI Chat Agent", bullets: ["Multi-agent support", "Context-aware responses", "ERP integration"] }, description: "Multi-agent AI chat system with context-aware responses, ERP integration, and translation capabilities." },
  { id: "approval-eng", label: "Approval",   hint: "Approvals",      layer: "ai", accent: "violet", icon: CheckCircle,  detail: { title: "Approval Engine", bullets: ["Multi-step approval flows", "Role-based approval chains", "Audit trail logging"] }, description: "Multi-step approval workflow engine with role-based chains and full audit trail logging." },
  { id: "state-machine", label: "State Machine", hint: "Workflows",  layer: "ai", accent: "violet", icon: Workflow,     detail: { title: "State Machine", bullets: ["Draft → Review → Approved → Complete", "Failed → Retry → Dead Letter", "Configurable transitions"] }, description: "Configurable state machine managing entity lifecycle transitions with retry and dead-letter handling." },
  { id: "rules-engine", label: "Rules Engine", hint: "Business rules", layer: "ai", accent: "violet", icon: Scale,      detail: { title: "Rules Engine", bullets: ["Conditional logic execution", "Threshold-based triggers", "Dynamic rule evaluation"] }, description: "Evaluates business rules with conditional logic, threshold triggers, and dynamic rule chains." },
  { id: "knowledge-rag", label: "Knowledge", hint: "RAG store",      layer: "ai", accent: "violet", icon: Library,    detail: { title: "Knowledge / RAG", bullets: ["Document embeddings", "Semantic search", "Context retrieval for AI"] }, description: "RAG knowledge store with document embeddings and semantic search for AI context retrieval." },
  { id: "notif-hub",     label: "Notifications", hint: "Alert routing", layer: "ai", accent: "violet", icon: BellRing, detail: { title: "Notification Hub", bullets: ["Multi-channel routing", "Escalation chains", "Digest & batching"] }, description: "Routes alerts across email, SMS, push, and Slack with escalation chains and digest batching." },

  // Agents — Revenue
  { id: "ag-blitz",   label: "Blitz",     hint: "Sales Agent",      layer: "ai", accent: "violet", icon: TrendingUp,      detail: { title: "Blitz — Sales Agent", bullets: ["Pipeline management", "Lead follow-ups", "Deal tracking & outreach"] }, description: "AI sales agent that manages pipeline, automates lead follow-ups, and tracks deal progression." },
  { id: "ag-penny",   label: "Penny",     hint: "Accounting Agent", layer: "ai", accent: "violet", icon: Calculator,      detail: { title: "Penny — Accounting Agent", bullets: ["Invoice management", "QuickBooks sync", "Overdue balance tracking"] }, description: "AI accounting agent for invoice management, QuickBooks synchronization, and overdue tracking." },
  { id: "ag-gauge",   label: "Gauge",     hint: "Estimating Agent", layer: "ai", accent: "violet", icon: Ruler,           detail: { title: "Gauge — Estimating Agent", bullets: ["Takeoff from drawings", "Rebar calculations", "Estimate reviews"] }, description: "AI estimating agent that performs takeoffs from drawings and calculates rebar quantities." },
  { id: "ag-kala",    label: "Kala",      hint: "Purchasing Agent",  layer: "ai", accent: "violet", icon: Boxes,           detail: { title: "Kala — Purchasing Agent", bullets: ["Material procurement", "Vendor management", "Purchase order tracking"] }, description: "AI purchasing agent for material procurement, vendor management, and purchase order tracking." },

  // Agents — Operations
  { id: "ag-forge",   label: "Forge",     hint: "Shop Floor Agent", layer: "ai", accent: "violet", icon: Wrench,          detail: { title: "Forge — Shop Floor Agent", bullets: ["Work order management", "Machine scheduling", "Production tracking"] }, description: "AI shop floor agent managing work orders, machine scheduling, and production throughput." },
  { id: "ag-atlas",   label: "Atlas",     hint: "Delivery Agent",   layer: "ai", accent: "violet", icon: Truck,           detail: { title: "Atlas — Delivery Agent", bullets: ["Route planning", "Delivery tracking", "Schedule optimization"] }, description: "AI delivery agent for route planning, delivery tracking, and schedule optimization." },
  { id: "ag-relay",   label: "Relay",     hint: "Email Agent",      layer: "ai", accent: "violet", icon: MailCheck,        detail: { title: "Relay — Email Agent", bullets: ["Email summarization", "AI reply drafting", "Action item extraction"] }, description: "AI email agent that summarizes threads, drafts replies, and extracts action items." },

  // Agents — Support
  { id: "ag-haven",   label: "Haven",     hint: "Support Agent",    layer: "ai", accent: "violet", icon: HeadphonesIcon,  detail: { title: "Haven — Support Agent", bullets: ["Customer issue triage", "Ticket management", "Response drafting"] }, description: "AI support agent for customer issue triage, ticket management, and response drafting." },

  // Agents — Growth
  { id: "ag-pixel",   label: "Pixel",     hint: "Social Agent",     layer: "ai", accent: "violet", icon: Share2,          detail: { title: "Pixel — Social Media Agent", bullets: ["Content creation", "Post scheduling", "Performance analytics"] }, description: "AI social media agent for content creation, post scheduling, and engagement analytics." },
  { id: "ag-seomi",   label: "Seomi",     hint: "SEO Agent",        layer: "ai", accent: "violet", icon: Eye,             detail: { title: "Seomi — SEO Agent", bullets: ["SEO audits", "Meta tag optimization", "Blog content strategy"] }, description: "AI SEO agent that runs audits, optimizes meta tags, and plans content strategy." },
  { id: "ag-buddy",   label: "Buddy",     hint: "BizDev Agent",     layer: "ai", accent: "violet", icon: Compass,         detail: { title: "Buddy — Business Development Agent", bullets: ["Market analysis", "Partnership discovery", "Growth planning"] }, description: "AI business development agent for market analysis, partnership discovery, and growth planning." },
  { id: "ag-commet",  label: "Commet",    hint: "Web Builder Agent", layer: "ai", accent: "violet", icon: Palette,        detail: { title: "Commet — Web Builder Agent", bullets: ["Website audits", "Landing page suggestions", "Copy writing"] }, description: "AI web builder agent for website audits, landing page optimization, and copy improvements." },
  { id: "ag-penn",    label: "Penn",      hint: "Copywriting Agent", layer: "ai", accent: "violet", icon: PenTool,        detail: { title: "Penn — Copywriting Agent", bullets: ["Proposal writing", "Email campaigns", "Product descriptions"] }, description: "AI copywriting agent for proposals, email campaigns, and product descriptions." },
  { id: "ag-gigi",    label: "Gigi",      hint: "Growth Agent",     layer: "ai", accent: "violet", icon: Sprout,          detail: { title: "Gigi — Growth Agent", bullets: ["Goal setting", "Productivity coaching", "Team development"] }, description: "AI growth agent for goal setting, productivity coaching, and team development planning." },
  { id: "ag-scouty",  label: "Scouty",    hint: "Talent Agent",     layer: "ai", accent: "violet", icon: UserSearch,      detail: { title: "Scouty — Talent Agent", bullets: ["Job postings", "Interview preparation", "Onboarding checklists"] }, description: "AI talent agent for job postings, interview preparation, and onboarding workflow automation." },
  { id: "ag-prism",   label: "Prism",     hint: "Data Agent",       layer: "ai", accent: "violet", icon: BarChart3,       detail: { title: "Prism — Data Analytics Agent", bullets: ["KPI dashboards", "Trend analysis", "Report generation"] }, description: "AI data analytics agent for KPI dashboards, trend analysis, and automated report generation." },

  // Agents — Special Ops
  { id: "ag-architect", label: "Architect", hint: "Empire Agent",   layer: "ai", accent: "violet", icon: Crown,           detail: { title: "Architect — Empire Builder Agent", bullets: ["Venture management", "Cross-platform diagnostics", "Business stress testing"] }, description: "AI empire builder agent for venture management, cross-platform diagnostics, and stress testing." },
  { id: "ag-tally",     label: "Tally",     hint: "Legal Agent",   layer: "ai", accent: "violet", icon: Scale,           detail: { title: "Tally — Legal Agent", bullets: ["Contract review", "Lien rights guidance", "Compliance checks"] }, description: "AI legal agent for contract review, lien rights guidance, and regulatory compliance checks." },

  // Layer 5: Integrations (Edge Functions)
  { id: "fn-social",   label: "Social",     hint: "Publish",        layer: "backend", accent: "blue", icon: Share2,     detail: { title: "Social Publish", bullets: ["Meta Graph API", "Multi-platform scheduling", "Content queue"] } },
  { id: "fn-stripe",   label: "Stripe API",  hint: "Payments",       layer: "backend", accent: "blue", icon: CreditCard, detail: { title: "Stripe Integration", bullets: ["Payment processing", "Webhook handling", "Invoice management"] } },
  { id: "fn-ring",     label: "RC API",      hint: "Telephony",     layer: "backend", accent: "blue", icon: Phone,      detail: { title: "RingCentral Sync", bullets: ["Call log sync", "Webhook events", "SMS integration"] } },
  { id: "fn-gmail",    label: "Gmail",       hint: "Email API",      layer: "backend", accent: "blue", icon: MailOpen,   detail: { title: "Gmail Integration", bullets: ["Email send & receive", "Thread tracking", "Draft management"] } },
  { id: "fn-odoo",     label: "Odoo Sync",   hint: "ERP sync",       layer: "backend", accent: "blue", icon: Building2,  detail: { title: "Odoo Integration", bullets: ["Product & inventory sync", "Order management", "XML-RPC bridge"] } },
  { id: "fn-qb",       label: "QB Sync",     hint: "Accounting",     layer: "backend", accent: "blue", icon: BookOpen,   detail: { title: "QuickBooks Sync", bullets: ["Customer & invoice mirroring", "OAuth2 token refresh", "Balance sync"] } },
  { id: "fn-seo",      label: "SEO Engine", hint: "Audit",          layer: "backend", accent: "blue", icon: FileSearch, detail: { title: "SEO Backend", bullets: ["PageSpeed analysis", "Core Web Vitals", "Keyword tracking"] } },
  { id: "fn-ai",       label: "AI Gateway", hint: "LLM proxy",      layer: "backend", accent: "blue", icon: Zap,        detail: { title: "AI Gateway", bullets: ["Multi-model routing", "Usage logging", "Rate limiting"] } },
  { id: "fn-push",     label: "Push",       hint: "Notifications",  layer: "backend", accent: "blue", icon: Bell,       detail: { title: "Push Notifications", bullets: ["DB trigger pipeline", "Multi-channel delivery", "Escalation rules"] } },
  { id: "cameras",     label: "Cameras",    hint: "Security",       layer: "backend", accent: "blue", icon: Camera,     detail: { title: "Camera / Security", bullets: ["RTSP camera feeds", "Face recognition", "Event detection & alerts"] } },
  { id: "fn-website",  label: "Website",    hint: "Agent + chat",   layer: "backend", accent: "blue", icon: Globe2,     detail: { title: "Website Agent", bullets: ["Website chat widget", "AI-powered responses", "Lead capture"] } },
  { id: "fn-mcp",      label: "MCP",        hint: "Agent protocol", layer: "backend", accent: "blue", icon: Plug,       detail: { title: "MCP Server", bullets: ["Model Context Protocol", "Tool registry", "Agent interop bridge"] } },

  // Layer 6: External Services
  { id: "ext-meta",    label: "Meta",       hint: "FB & IG",        layer: "external", accent: "rose", icon: Instagram,   detail: { title: "Meta Platform", bullets: ["Facebook Graph API", "Instagram Business API", "Ad campaigns"] } },
  { id: "ext-stripe",  label: "Stripe",     hint: "Payments",       layer: "external", accent: "rose", icon: DollarSign,  detail: { title: "Stripe", bullets: ["Payment processing", "Subscription billing", "Webhook events"] } },
  { id: "ext-rc",      label: "RingCentral", hint: "VoIP",          layer: "external", accent: "rose", icon: PhoneCall,   detail: { title: "RingCentral", bullets: ["Voice & SMS API", "Call recording", "WebRTC"] } },
  { id: "ext-google",  label: "Google",     hint: "Suite",          layer: "external", accent: "rose", icon: Chrome,      detail: { title: "Google Services", bullets: ["Gmail API", "Search Console", "OAuth2"] } },
  { id: "ext-odoo",    label: "Odoo",       hint: "ERP",            layer: "external", accent: "rose", icon: Boxes,       detail: { title: "Odoo ERP", bullets: ["XML-RPC API", "Inventory", "Product catalog"] } },
  { id: "ext-qb",      label: "QuickBooks", hint: "Intuit",         layer: "external", accent: "rose", icon: Receipt,     detail: { title: "QuickBooks Online", bullets: ["REST API v3", "Invoice sync", "OAuth2"] } },
  { id: "ext-openai",  label: "OpenAI",     hint: "GPT & Realtime", layer: "external", accent: "rose", icon: Sparkles,    detail: { title: "OpenAI", bullets: ["GPT-4o", "Realtime API", "Embeddings"] } },
  { id: "ext-eleven",  label: "ElevenLabs", hint: "Voice + TTS",    layer: "external", accent: "rose", icon: AudioLines,  detail: { title: "ElevenLabs", bullets: ["Text-to-speech", "Voice cloning", "Music generation"] } },

  // Layer 7: Data + Platform
  { id: "primary-db",    label: "Primary DB",    hint: "PostgreSQL",   layer: "platform", accent: "amber", icon: Database,      detail: { title: "Primary Database", bullets: ["Supabase PostgreSQL", "RLS policies", "Source of truth"] } },
  { id: "obj-storage",   label: "Storage",       hint: "Files & media", layer: "platform", accent: "amber", icon: Archive,       detail: { title: "Object Storage", bullets: ["Supabase Storage", "Media uploads", "CDN delivery"] } },
  { id: "redis-cache",   label: "Redis Cache",   hint: "Fast reads",   layer: "platform", accent: "amber", icon: Zap,           detail: { title: "Redis Cache", bullets: ["Session cache", "Rate limit counters", "Hot data"] } },
  { id: "search-idx",    label: "Search Index",  hint: "Full-text",    layer: "platform", accent: "amber", icon: Search,        detail: { title: "Search Index", bullets: ["Full-text search", "Faceted filtering", "Relevance ranking"] } },
  { id: "event-log",     label: "Event Log",     hint: "Audit trail",  layer: "platform", accent: "amber", icon: Activity,      detail: { title: "Event Log", bullets: ["activity_events table", "All system actions", "Compliance audit"] } },
  { id: "job-queue",     label: "Job Queue",     hint: "Async hub",    layer: "platform", accent: "amber", icon: GitBranch,     detail: { title: "Job Queue", bullets: ["Async task dispatch", "Priority scheduling", "Retry policies"] } },
  { id: "worker-pool",   label: "Worker Pool",   hint: "Executors",    layer: "platform", accent: "amber", icon: Cpu,           detail: { title: "Worker Pool", bullets: ["Edge function workers", "Concurrent execution", "Auto-scaling"] } },
  { id: "retry-queue",   label: "Retry Queue",   hint: "Retries",      layer: "platform", accent: "amber", icon: RefreshCw,     detail: { title: "Retry Queue", bullets: ["Exponential backoff", "Max retry limits", "Failure routing"] } },
  { id: "dlq",           label: "Dead Letter",   hint: "Failed jobs",  layer: "platform", accent: "amber", icon: AlertTriangle, detail: { title: "Dead Letter Queue", bullets: ["Permanently failed jobs", "Manual review", "Alert triggers"] } },
  { id: "monitoring",    label: "Monitoring",    hint: "Observability", layer: "platform", accent: "amber", icon: MonitorCheck,  detail: { title: "Monitoring", bullets: ["Prometheus metrics", "Grafana dashboards", "Alerting rules"] } },
  { id: "error-track",   label: "Error Track",   hint: "Errors",       layer: "platform", accent: "amber", icon: ServerCrash,   detail: { title: "Error Tracking", bullets: ["Exception capture", "Stack trace logging", "Error grouping"] } },
  { id: "cicd",          label: "CI/CD",         hint: "Deploy",       layer: "platform", accent: "amber", icon: Rocket,        detail: { title: "CI/CD Pipeline", bullets: ["Automated builds", "Test suites", "Zero-downtime deploy"] } },
  { id: "secrets-mgr",   label: "Secrets",       hint: "Vault",        layer: "platform", accent: "amber", icon: Lock,          detail: { title: "Secrets Manager", bullets: ["API key storage", "Token rotation", "Encrypted vault"] } },
  { id: "backups",       label: "Backups",       hint: "Recovery",     layer: "platform", accent: "amber", icon: DownloadCloud, detail: { title: "Backups", bullets: ["Daily snapshots", "Point-in-time recovery", "Geo-redundant storage"] } },
  { id: "admin-console", label: "Admin",         hint: "Management",   layer: "platform", accent: "amber", icon: Users,         detail: { title: "Admin Console", bullets: ["User management", "System configuration", "Feature flags"] } },
  { id: "settings",      label: "Settings",      hint: "Config",       layer: "platform", accent: "amber", icon: Settings,       detail: { title: "Settings", bullets: ["App configuration", "User preferences", "System parameters"] } },
  { id: "cdn-edge",      label: "CDN / Edge",    hint: "Delivery",     layer: "platform", accent: "amber", icon: Globe,         detail: { title: "CDN / Edge", bullets: ["Static asset delivery", "Edge caching", "Global distribution"] } },
  { id: "memory-store",  label: "Memory",        hint: "AI & CRM memory", layer: "platform", accent: "amber", icon: MemoryStick,   detail: { title: "Memory Store", bullets: ["Vizzy brain & lead memory", "Qualification / quote / loss memory", "Client performance memory"] } },
  { id: "realtime",      label: "Realtime",      hint: "Live events",  layer: "platform", accent: "amber", icon: Radio,         detail: { title: "Realtime Engine", bullets: ["Supabase Realtime", "Live chat & dashboards", "Presence & notifications"] } },
  { id: "rate-limiter",  label: "Rate Limiter",  hint: "Throttle",     layer: "platform", accent: "amber", icon: Gauge,         detail: { title: "Rate Limiter", bullets: ["Request rate limiting", "Per-user & per-route limits", "Burst protection"] } },
  { id: "session-store", label: "Sessions",      hint: "Auth state",   layer: "platform", accent: "amber", icon: Key,           detail: { title: "Session Store", bullets: ["Auth session management", "Token storage & rotation", "SSO state"] } },
  { id: "analytics",     label: "Analytics",     hint: "Telemetry",    layer: "platform", accent: "amber", icon: BarChart3,     detail: { title: "Analytics", bullets: ["Usage metrics", "System telemetry", "AI cost tracking"] } },
  { id: "log-agg",       label: "Log Aggregator", hint: "System logs", layer: "platform", accent: "amber", icon: FileText,      detail: { title: "Log Aggregator", bullets: ["Centralized log collection", "Structured logging", "Log retention policies"] } },
  { id: "health",        label: "Health Check",  hint: "Uptime",       layer: "platform", accent: "amber", icon: HeartPulse,    detail: { title: "Health Checks", bullets: ["Endpoint health probes", "Liveness & readiness", "Uptime monitoring"] } },
  { id: "feature-flags", label: "Feature Flags", hint: "Toggles",      layer: "platform", accent: "amber", icon: ToggleRight,   detail: { title: "Feature Flags", bullets: ["Feature toggles", "Gradual rollouts", "A/B testing gates"] } },
  { id: "msg-bus",       label: "Message Bus",   hint: "Pub/Sub",      layer: "platform", accent: "amber", icon: Bus,           detail: { title: "Message Bus", bullets: ["Event-driven Pub/Sub", "Inter-service communication", "Async decoupling"] } },
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

  // Auth → Modules (representative edges — all modules sit behind role-guard)
  { id: "e10", source: "role-guard", target: "crm",        edgeStyle: "solid", label: "RBAC" },
  { id: "e11", source: "role-guard", target: "shop-floor", edgeStyle: "solid" },
  { id: "e13", source: "role-guard", target: "accounting", edgeStyle: "solid" },

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
  { id: "e60", source: "crm",         target: "primary-db",   edgeStyle: "dashed", label: "all modules persist" },
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

  // New systems edges
  { id: "e100", source: "estimating",    target: "qa-war",         edgeStyle: "solid",  label: "verify" },
  { id: "e101", source: "quotes",        target: "fn-stripe",      edgeStyle: "solid",  label: "pay" },
  { id: "e102", source: "inbox",         target: "fn-gmail",       edgeStyle: "solid",  label: "send" },
  { id: "e103", source: "inbox",         target: "fn-ring",        edgeStyle: "solid",  label: "call" },
  { id: "e104", source: "vizzy",         target: "knowledge-rag",  edgeStyle: "dashed", label: "RAG" },
  { id: "e105", source: "nila",          target: "knowledge-rag",  edgeStyle: "dashed", label: "RAG" },
  { id: "e106", source: "knowledge-rag", target: "primary-db",     edgeStyle: "solid",  label: "persist" },
  { id: "e107", source: "notif-hub",     target: "fn-push",        edgeStyle: "solid",  label: "deliver" },
  { id: "e108", source: "approval-eng",  target: "notif-hub",      edgeStyle: "dashed", label: "alert" },
  { id: "e109", source: "fn-website",    target: "fn-ai",          edgeStyle: "solid",  label: "AI" },
  { id: "e110", source: "fn-mcp",        target: "agent-rtr",      edgeStyle: "solid",  label: "bridge" },
  { id: "e111", source: "vizzy",         target: "ext-eleven",     edgeStyle: "dashed", label: "voice" },
  { id: "e112", source: "fn-website",    target: "ext-google",     edgeStyle: "dashed", label: "analytics" },
  { id: "e113", source: "payroll",       target: "accounting",     edgeStyle: "solid",  label: "export" },

  // Agent → Module / Integration edges
  { id: "ea1",  source: "ag-blitz",     target: "crm",          edgeStyle: "solid",  label: "leads" },
  { id: "ea2",  source: "ag-blitz",     target: "pipeline",     edgeStyle: "solid" },
  { id: "ea3",  source: "ag-penny",     target: "accounting",   edgeStyle: "solid",  label: "invoices" },
  { id: "ea4",  source: "ag-penny",     target: "fn-qb",        edgeStyle: "dashed", label: "sync" },
  { id: "ea5",  source: "ag-gauge",     target: "estimating",   edgeStyle: "solid",  label: "takeoff" },
  { id: "ea6",  source: "ag-gauge",     target: "qa-war",       edgeStyle: "solid",  label: "verify" },
  { id: "ea7",  source: "ag-kala",      target: "shop-floor",   edgeStyle: "solid",  label: "purchase" },
  { id: "ea8",  source: "ag-forge",     target: "shop-floor",   edgeStyle: "solid",  label: "produce" },
  { id: "ea9",  source: "ag-forge",     target: "state-machine", edgeStyle: "dashed" },
  { id: "ea10", source: "ag-atlas",     target: "shop-floor",   edgeStyle: "solid",  label: "deliver" },
  { id: "ea11", source: "ag-relay",     target: "inbox",        edgeStyle: "solid",  label: "email" },
  { id: "ea12", source: "ag-relay",     target: "fn-gmail",     edgeStyle: "dashed", label: "send" },
  { id: "ea13", source: "ag-haven",     target: "chat",         edgeStyle: "solid",  label: "support" },
  { id: "ea14", source: "ag-haven",     target: "notif-hub",    edgeStyle: "dashed", label: "alert" },
  { id: "ea15", source: "ag-pixel",     target: "fn-social",    edgeStyle: "solid",  label: "publish" },
  { id: "ea16", source: "ag-pixel",     target: "ext-meta",     edgeStyle: "dashed", label: "post" },
  { id: "ea17", source: "ag-seomi",     target: "seo",          edgeStyle: "solid",  label: "audit" },
  { id: "ea18", source: "ag-seomi",     target: "fn-seo",       edgeStyle: "dashed", label: "crawl" },
  { id: "ea19", source: "ag-buddy",     target: "crm",          edgeStyle: "solid",  label: "partners" },
  { id: "ea20", source: "ag-buddy",     target: "pipeline",     edgeStyle: "dashed" },
  { id: "ea21", source: "ag-commet",    target: "fn-website",   edgeStyle: "solid",  label: "build" },
  { id: "ea22", source: "ag-penn",      target: "email",        edgeStyle: "solid",  label: "copy" },
  { id: "ea23", source: "ag-penn",      target: "fn-social",    edgeStyle: "dashed", label: "content" },
  { id: "ea24", source: "ag-gigi",      target: "pipeline",     edgeStyle: "solid",  label: "goals" },
  { id: "ea25", source: "ag-scouty",    target: "team-hub",     edgeStyle: "solid",  label: "hire" },
  { id: "ea26", source: "ag-prism",     target: "analytics",    edgeStyle: "solid",  label: "KPIs" },
  { id: "ea27", source: "ag-prism",     target: "primary-db",   edgeStyle: "dashed", label: "query" },
  { id: "ea28", source: "ag-architect", target: "fn-odoo",      edgeStyle: "solid",  label: "ERP" },
  { id: "ea29", source: "ag-architect", target: "fn-mcp",       edgeStyle: "dashed", label: "bridge" },
  { id: "ea30", source: "ag-tally",     target: "rules-engine", edgeStyle: "solid",  label: "comply" },
  // All agents → AI Gateway
  { id: "ea31", source: "ag-blitz",     target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea32", source: "ag-penny",     target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea33", source: "ag-gauge",     target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea34", source: "ag-forge",     target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea35", source: "ag-haven",     target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea36", source: "ag-pixel",     target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea37", source: "ag-seomi",     target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea38", source: "ag-buddy",     target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea39", source: "ag-commet",    target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea40", source: "ag-penn",      target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea41", source: "ag-gigi",      target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea42", source: "ag-scouty",    target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea43", source: "ag-prism",     target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea44", source: "ag-architect", target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea45", source: "ag-tally",     target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea46", source: "ag-kala",      target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea47", source: "ag-atlas",     target: "fn-ai",        edgeStyle: "dashed" },
  { id: "ea48", source: "ag-relay",     target: "fn-ai",        edgeStyle: "dashed" },

  // New module edges
  { id: "em1",  source: "dashboard",    target: "primary-db",    edgeStyle: "dashed", label: "data" },
  { id: "em2",  source: "dashboard",    target: "analytics",     edgeStyle: "solid",  label: "KPIs" },
  { id: "em3",  source: "dashboard",    target: "realtime",      edgeStyle: "dashed", label: "live" },
  { id: "em4",  source: "biz-tasks",    target: "pipeline",      edgeStyle: "solid",  label: "workflow" },
  { id: "em5",  source: "biz-tasks",    target: "state-machine", edgeStyle: "dashed" },
  { id: "em6",  source: "biz-tasks",    target: "approval-eng",  edgeStyle: "solid",  label: "approve" },
  { id: "em7",  source: "live-monitor", target: "realtime",      edgeStyle: "solid",  label: "stream" },
  { id: "em8",  source: "live-monitor", target: "monitoring",    edgeStyle: "solid" },
  { id: "em9",  source: "live-monitor", target: "shop-floor",    edgeStyle: "dashed", label: "status" },
  { id: "em10", source: "ceo-portal",   target: "analytics",     edgeStyle: "solid",  label: "reports" },
  { id: "em11", source: "ceo-portal",   target: "primary-db",    edgeStyle: "dashed", label: "data" },
  { id: "em12", source: "ceo-portal",   target: "pipeline",      edgeStyle: "dashed" },
  { id: "em13", source: "support",      target: "chat",          edgeStyle: "solid",  label: "tickets" },
  { id: "em14", source: "support",      target: "ag-haven",      edgeStyle: "solid",  label: "AI" },
  { id: "em15", source: "support",      target: "notif-hub",     edgeStyle: "dashed", label: "alert" },
  { id: "em16", source: "lead-scoring", target: "crm",           edgeStyle: "solid",  label: "leads" },
  { id: "em17", source: "lead-scoring", target: "fn-ai",         edgeStyle: "dashed", label: "score" },
  { id: "em18", source: "lead-scoring", target: "pipeline",      edgeStyle: "dashed" },
  { id: "em19", source: "customers",    target: "crm",           edgeStyle: "solid",  label: "contacts" },
  { id: "em20", source: "customers",    target: "primary-db",    edgeStyle: "dashed", label: "data" },
  { id: "em21", source: "sales",        target: "crm",           edgeStyle: "solid",  label: "deals" },
  { id: "em22", source: "sales",        target: "quotes",        edgeStyle: "solid",  label: "quote" },
  { id: "em23", source: "sales",        target: "ag-blitz",      edgeStyle: "dashed", label: "AI" },
  { id: "em24", source: "sales",        target: "pipeline",      edgeStyle: "dashed" },
  { id: "em25", source: "time-clock",   target: "team-hub",      edgeStyle: "solid",  label: "hours" },
  { id: "em26", source: "time-clock",   target: "kiosk",         edgeStyle: "solid",  label: "punch" },
  { id: "em27", source: "time-clock",   target: "payroll",       edgeStyle: "solid",  label: "wages" },
  { id: "em28", source: "office-tools", target: "primary-db",    edgeStyle: "dashed", label: "data" },
  { id: "em29", source: "office-tools", target: "obj-storage",   edgeStyle: "dashed", label: "files" },
  { id: "em30", source: "inventory",    target: "shop-floor",    edgeStyle: "solid",  label: "stock" },
  { id: "em31", source: "inventory",    target: "fn-odoo",       edgeStyle: "dashed", label: "sync" },
  { id: "em32", source: "inventory",    target: "ag-kala",       edgeStyle: "dashed", label: "order" },
  { id: "em33", source: "diagnostics",  target: "monitoring",    edgeStyle: "solid",  label: "health" },
  { id: "em34", source: "diagnostics",  target: "health",        edgeStyle: "solid" },
  { id: "em35", source: "diagnostics",  target: "error-track",   edgeStyle: "solid",  label: "errors" },
  { id: "em36", source: "settings",     target: "feature-flags", edgeStyle: "solid",  label: "toggles" },
  { id: "em37", source: "settings",     target: "secrets-mgr",   edgeStyle: "dashed", label: "keys" },
  { id: "em38", source: "settings",     target: "admin-console", edgeStyle: "solid" },

  // Role-guard → new modules
  { id: "em40", source: "role-guard",   target: "dashboard",     edgeStyle: "solid" },
  { id: "em41", source: "role-guard",   target: "support",       edgeStyle: "solid" },
  { id: "em42", source: "role-guard",   target: "sales",         edgeStyle: "solid" },
];

/* ───── Helpers ───── */
export function nodesInLayer(layer: ArchLayer): ArchNode[] {
  return ARCH_NODES.filter((n) => n.layer === layer);
}

export const LAYER_LABELS: Record<ArchLayer, string> = {
  entry: "Entry Points",
  auth: "Access Control",
  items: "System Items",
  ai: "AI / Automation",
  backend: "Integrations",
  external: "External Services",
  platform: "Data + Platform",
};
