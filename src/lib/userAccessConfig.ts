/**
 * Centralized source-of-truth for per-user menu visibility and agent access.
 *
 * Every internal user is mapped by email to:
 *   - menus they can see in the sidebar
 *   - agents they can interact with
 *   - their primary agent (shown first, used for Home hero)
 *   - hero text for the Home page
 *
 * Users with `fullAccess: true` see everything.
 * Unknown internal users get a minimal default.
 */

import { agentConfigs } from "@/components/agent/agentConfigs";

// ─── Canonical menu keys (must match sidebar NavItem names) ─────────────
export const ALL_MENUS = [
  "Dashboard", "Inbox", "Team Hub", "Business Tasks", "Live Monitor",
  "CEO Portal", "Support", "Pipeline", "Lead Scoring", "Customers",
  "Accounting", "Sales", "Shop Floor", "Time Clock", "Office Tools",
  "Inventory", "Diagnostics", "Architecture", "Settings", "Admin Panel",
  "Kiosk",
] as const;

export type MenuKey = (typeof ALL_MENUS)[number];

// ─── Canonical agent keys (must match agentConfigs keys) ────────────────
export const ALL_AGENTS = Object.keys(agentConfigs);

// ─── Quick-action shape ─────────────────────────────────────────────────
interface QuickAction {
  title: string;
  prompt: string;
  icon: string;
  category: string;
}

// ─── Per-user config ────────────────────────────────────────────────────
interface UserConfig {
  fullAccess?: boolean;
  menus: MenuKey[];
  agents: string[];
  primaryAgent?: string;
  heroText?: string;
  quickActions?: QuickAction[];
}

const USER_ACCESS: Record<string, UserConfig> = {
  "sattar@rebar.shop": {
    menus: [
      "Dashboard", "Inbox", "Team Hub", "Business Tasks", "Live Monitor",
      "CEO Portal", "Support", "Pipeline", "Lead Scoring", "Customers",
      "Accounting", "Sales", "Shop Floor", "Time Clock", "Office Tools",
      "Inventory", "Diagnostics", "Architecture", "Settings", "Admin Panel",
    ],
    agents: ALL_AGENTS,
    primaryAgent: "assistant",
    heroText: "How can your **CEO Portal** help you today?",
    quickActions: [
      { title: "Business Health Score", prompt: "Give me the full business health score — production, revenue, AR, team attendance, and machine status. Highlight anything that needs my attention.", icon: "Activity", category: "Executive" },
      { title: "Today's exceptions", prompt: "Show me today's exceptions only — anything overdue, blocked, or flagged across all departments.", icon: "AlertTriangle", category: "Executive" },
      { title: "Pipeline overview", prompt: "Give me a pipeline summary — active leads, expected close dates, and any deals that need attention.", icon: "TrendingUp", category: "Sales" },
      { title: "Team attendance", prompt: "Show me today's team attendance — who's clocked in, who's absent, and any patterns to watch.", icon: "Users", category: "HR" },
    ],
  },

  "radin@rebar.shop": {
    fullAccess: true,
    menus: [],
    agents: [],
    primaryAgent: "assistant",
    heroText: "How can **Vizzy** help you today?",
    quickActions: [
      { title: "Business Health Score", prompt: "Give me the full business health score — production, revenue, AR, team attendance, and machine status. Highlight anything that needs my attention.", icon: "Activity", category: "Executive" },
      { title: "Today's exceptions", prompt: "Show me today's exceptions only — anything overdue, blocked, or flagged across all departments.", icon: "AlertTriangle", category: "Executive" },
      { title: "AI agent activity", prompt: "Show me a summary of all AI agent sessions today — who used which agent, and what actions were taken.", icon: "Bot", category: "AI" },
      { title: "Team attendance", prompt: "Show me today's team attendance — who's clocked in, who's absent, and any patterns to watch.", icon: "Users", category: "HR" },
    ],
  },

  "zahra@rebar.shop": {
    menus: ["Business Tasks", "Support"],
    agents: ["social", "eisenhower", "support"],
    primaryAgent: "social",
    heroText: "How can **Pixel** assist you today?",
    quickActions: [
      { title: "Generate post", prompt: "Create a new social media post for today — pick the best platform and generate a caption and image.", icon: "Sparkles", category: "Content" },
      { title: "Prioritize my tasks", prompt: "Help me organize my tasks using the Eisenhower Matrix — what's urgent vs important right now?", icon: "LayoutGrid", category: "Eisenhower" },
      { title: "Customer inquiry", prompt: "Show me recent customer inquiries and support tickets that need attention.", icon: "HeadphonesIcon", category: "Customer Care" },
      { title: "Compliance check", prompt: "Review our recent content and campaigns for legal compliance — disclaimers, permissions, and regulations.", icon: "Shield", category: "Legal" },
    ],
  },

  "neel@rebar.shop": {
    menus: [
      "Dashboard", "Inbox", "Team Hub", "Business Tasks", "Live Monitor",
      "Support", "Pipeline", "Lead Scoring", "Customers", "Accounting",
      "Sales", "Shop Floor", "Time Clock", "Office Tools",
      "Inventory", "Diagnostics", "Architecture", "Settings",
    ] as MenuKey[],
    agents: ALL_AGENTS.filter((a) => a !== "assistant"),
    primaryAgent: "sales",
    heroText: "How can **Blitz** help you close deals today?",
    quickActions: [
      { title: "Pipeline overview", prompt: "Give me a pipeline summary — active leads, expected close dates, and any deals that need attention.", icon: "TrendingUp", category: "Sales" },
      { title: "Follow-up queue", prompt: "Show me leads that need follow-up today — overdue responses, pending quotes, and stale conversations.", icon: "Clock", category: "Sales" },
      { title: "New RFQs", prompt: "Show me any new RFQ emails that came in today that need quoting.", icon: "FileText", category: "Sales" },
      { title: "Customer check-in", prompt: "Which customers haven't heard from us in over a week? List them with last contact date.", icon: "Users", category: "Sales" },
    ],
  },

  "vicky@rebar.shop": {
    menus: ["Dashboard", "Team Hub", "Business Tasks", "Customers", "Accounting", "Architecture", "Settings"],
    agents: ["talent", "bizdev", "eisenhower", "accounting", "rebuild"],
    primaryAgent: "accounting",
    heroText: "How can **Penny** help you today?",
    quickActions: [
      { title: "AR aging", prompt: "Show me the accounts receivable aging report — who owes what and how overdue.", icon: "DollarSign", category: "AR" },
      { title: "Bills due", prompt: "What bills are due this week? Show amounts and vendors.", icon: "FileText", category: "AP" },
      { title: "Payroll check", prompt: "Run a payroll pre-check — flag any missing hours, overtime issues, or ESA compliance concerns.", icon: "Users", category: "Payroll" },
      { title: "Bank reconciliation", prompt: "Help me reconcile recent bank transactions with QuickBooks entries.", icon: "CreditCard", category: "Banking" },
    ],
  },

  "ben@rebar.shop": {
    menus: ["Dashboard", "Inbox", "Team Hub", "Pipeline", "Time Clock"],
    agents: ["sales", "support", "estimating", "eisenhower"],
    primaryAgent: "estimating",
    heroText: "How can **Gauge** help you today?",
    quickActions: [
      { title: "Open takeoffs", prompt: "Show me all open takeoff sessions and their status — pending reviews, QC flags, and deadlines.", icon: "FileText", category: "Estimating" },
      { title: "Pipeline overview", prompt: "Give me a pipeline summary — active leads, expected close dates, and any deals that need attention.", icon: "TrendingUp", category: "Sales" },
      { title: "Customer inquiry", prompt: "Show me recent customer inquiries and support tickets that need attention.", icon: "HeadphonesIcon", category: "Customer Care" },
      { title: "Prioritize my tasks", prompt: "Help me organize my tasks using the Eisenhower Matrix — what's urgent vs important right now?", icon: "LayoutGrid", category: "Eisenhower" },
    ],
  },

  "saurabh@rebar.shop": {
    menus: [
      "Dashboard", "Inbox", "Team Hub", "Business Tasks", "Live Monitor",
      "Support", "Pipeline", "Lead Scoring", "Customers", "Sales",
      "Shop Floor", "Time Clock", "Office Tools", "Inventory",
      "Architecture", "Settings",
    ],
    agents: [
      "sales", "shopfloor", "email", "support", "bizdev", "eisenhower",
      "talent", "webbuilder", "copywriting", "seo", "growth", "purchasing", "estimating",
    ],
    primaryAgent: "sales",
    heroText: "How can **Blitz** help you close deals today?",
    quickActions: [
      { title: "Pipeline overview", prompt: "Give me a pipeline summary — active leads, expected close dates, and any deals that need attention.", icon: "TrendingUp", category: "Sales" },
      { title: "Follow-up queue", prompt: "Show me leads that need follow-up today — overdue responses, pending quotes, and stale conversations.", icon: "Clock", category: "Sales" },
      { title: "New RFQs", prompt: "Show me any new RFQ emails that came in today that need quoting.", icon: "FileText", category: "Sales" },
      { title: "Customer check-in", prompt: "Which customers haven't heard from us in over a week? List them with last contact date.", icon: "Users", category: "Sales" },
    ],
  },

  "kourosh@rebar.shop": {
    menus: ["Time Clock", "Shop Floor", "Team Hub"],
    agents: [],
    heroText: "Welcome, Kourosh",
  },

  "ai@rebar.shop": {
    menus: ["Kiosk", "Shop Floor", "Team Hub"],
    agents: ["shopfloor", "talent"],
    primaryAgent: "shopfloor",
  },

  "swapnil.m183@gmail.com": {
    menus: ["Time Clock", "Team Hub"],
    agents: ["talent"],
  },

  "tariq0001010@gmail.com": {
    menus: ["Time Clock", "Team Hub"],
    agents: ["talent"],
  },
};

// ─── Helper functions ───────────────────────────────────────────────────

function resolveConfig(email?: string | null): UserConfig | null {
  if (!email) return null;
  return USER_ACCESS[email.toLowerCase()] ?? null;
}

/** Returns the list of menu keys visible to this user. Unknown users → all. */
export function getVisibleMenus(email?: string | null): string[] {
  const cfg = resolveConfig(email);
  if (!cfg) return [...ALL_MENUS]; // unknown internal → show all (RoleGuard still blocks)
  if (cfg.fullAccess) return [...ALL_MENUS];
  return cfg.menus;
}

/** Returns the list of agent keys the user can access. Unknown → empty. */
export function getVisibleAgents(email?: string | null): string[] {
  const cfg = resolveConfig(email);
  if (!cfg) return [];
  if (cfg.fullAccess) return [...ALL_AGENTS];
  return cfg.agents;
}

/** Check if user can see a specific menu item. */
export function hasMenuAccess(email: string | null | undefined, menuKey: string): boolean {
  const visible = getVisibleMenus(email);
  return visible.includes(menuKey);
}

/** Check if user can access a specific agent. */
export function hasAgentAccess(email: string | null | undefined, agentKey: string): boolean {
  const visible = getVisibleAgents(email);
  return visible.includes(agentKey);
}

/** Get user's primary agent key. */
export function getUserPrimaryAgentKeyFromConfig(email?: string | null): string | null {
  const cfg = resolveConfig(email);
  return cfg?.primaryAgent ?? null;
}

/** Get user's hero text for Home page. */
export function getUserHeroText(email?: string | null): string | null {
  const cfg = resolveConfig(email);
  return cfg?.heroText ?? null;
}

/** Get user's quick actions for Home page. */
export function getUserQuickActions(email?: string | null): QuickAction[] {
  const cfg = resolveConfig(email);
  return cfg?.quickActions ?? [];
}

/** Get the full user config (for userAgentMap compatibility). */
export function getUserConfig(email?: string | null): UserConfig | null {
  return resolveConfig(email);
}
