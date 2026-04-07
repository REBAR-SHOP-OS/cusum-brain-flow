import { agentConfigs, AgentConfig } from "@/components/agent/agentConfigs";

interface UserAgentMapping {
  agentKey: string;
  userRole: string;
  quickActions: { title: string; prompt: string; icon: string; category: string }[];
  heroText: string;
}

const userAgentMappings: Record<string, UserAgentMapping> = {
  "sattar@rebar.shop": {
    agentKey: "assistant",
    userRole: "ceo",
    heroText: "How can your **CEO Portal** help you today?",
    quickActions: [
      { title: "Business Health Score", prompt: "Give me the full business health score — production, revenue, AR, team attendance, and machine status. Highlight anything that needs my attention.", icon: "Activity", category: "Executive" },
      { title: "Today's exceptions", prompt: "Show me today's exceptions only — anything overdue, blocked, or flagged across all departments.", icon: "AlertTriangle", category: "Executive" },
      { title: "Pipeline overview", prompt: "Give me a pipeline summary — active leads, expected close dates, and any deals that need attention.", icon: "TrendingUp", category: "Sales" },
      { title: "Team attendance", prompt: "Show me today's team attendance — who's clocked in, who's absent, and any patterns to watch.", icon: "Users", category: "HR" },
    ],
  },
  "kourosh@rebar.shop": {
    agentKey: "shopfloor",
    userRole: "shop_supervisor",
    heroText: "How can **Forge** help you today?",
    quickActions: [
      { title: "What machines are running?", prompt: "Show me the current status of all machines — which are running, idle, or down. Flag any that need attention.", icon: "Cog", category: "Machines" },
      { title: "Build cage from drawing", prompt: "I need help building a cage. Walk me through the fabrication steps from the drawing — which bars to cut first, bend sequence, and assembly order.", icon: "FileText", category: "Fabrication" },
      { title: "Maintenance schedule", prompt: "Show me the maintenance timeline for all machines — what's due, what's overdue, and recommended maintenance windows.", icon: "Wrench", category: "Maintenance" },
      { title: "Today's production queue", prompt: "Show me today's production queue — what's scheduled, what's in progress, and what's blocked.", icon: "ListOrdered", category: "Production" },
    ],
  },
  "saurabh@rebar.shop": {
    agentKey: "sales",
    userRole: "sales",
    heroText: "How can **Blitz** help you close deals today?",
    quickActions: [
      { title: "Pipeline overview", prompt: "Give me a pipeline summary — active leads, expected close dates, and any deals that need attention.", icon: "TrendingUp", category: "Sales" },
      { title: "Follow-up queue", prompt: "Show me leads that need follow-up today — overdue responses, pending quotes, and stale conversations.", icon: "Clock", category: "Sales" },
      { title: "New RFQs", prompt: "Show me any new RFQ emails that came in today that need quoting.", icon: "FileText", category: "Sales" },
      { title: "Customer check-in", prompt: "Which customers haven't heard from us in over a week? List them with last contact date.", icon: "Users", category: "Sales" },
    ],
  },
  "neel@rebar.shop": {
    agentKey: "sales",
    userRole: "sales",
    heroText: "How can **Blitz** help you close deals today?",
    quickActions: [
      { title: "Pipeline overview", prompt: "Give me a pipeline summary — active leads, expected close dates, and any deals that need attention.", icon: "TrendingUp", category: "Sales" },
      { title: "Follow-up queue", prompt: "Show me leads that need follow-up today — overdue responses, pending quotes, and stale conversations.", icon: "Clock", category: "Sales" },
      { title: "New RFQs", prompt: "Show me any new RFQ emails that came in today that need quoting.", icon: "FileText", category: "Sales" },
      { title: "Customer check-in", prompt: "Which customers haven't heard from us in over a week? List them with last contact date.", icon: "Users", category: "Sales" },
    ],
  },
  "radin@rebar.shop": {
    agentKey: "assistant",
    userRole: "ceo",
    heroText: "How can **Vizzy** help you today?",
    quickActions: [
      { title: "Business Health Score", prompt: "Give me the full business health score — production, revenue, AR, team attendance, and machine status. Highlight anything that needs my attention.", icon: "Activity", category: "Executive" },
      { title: "Today's exceptions", prompt: "Show me today's exceptions only — anything overdue, blocked, or flagged across all departments.", icon: "AlertTriangle", category: "Executive" },
      { title: "AI agent activity", prompt: "Show me a summary of all AI agent sessions today — who used which agent, and what actions were taken.", icon: "Bot", category: "AI" },
      { title: "Team attendance", prompt: "Show me today's team attendance — who's clocked in, who's absent, and any patterns to watch.", icon: "Users", category: "HR" },
    ],
  },
  "zahra@rebar.shop": {
    agentKey: "social",
    userRole: "social_media_manager",
    heroText: "How can **Pixel** assist you today?",
    quickActions: [
      { title: "Generate post", prompt: "Create a new social media post for today — pick the best platform and generate a caption and image.", icon: "Sparkles", category: "Content" },
      { title: "Prioritize my tasks", prompt: "Help me organize my tasks using the Eisenhower Matrix — what's urgent vs important right now?", icon: "LayoutGrid", category: "Eisenhower" },
      { title: "Customer inquiry", prompt: "Show me recent customer inquiries and support tickets that need attention.", icon: "HeadphonesIcon", category: "Customer Care" },
      { title: "Compliance check", prompt: "Review our recent content and campaigns for legal compliance — disclaimers, permissions, and regulations.", icon: "Shield", category: "Legal" },
    ],
  },
  "vicky@rebar.shop": {
    agentKey: "accounting",
    userRole: "accountant",
    heroText: "How can **Penny** help you today?",
    quickActions: [
      { title: "AR aging", prompt: "Show me the accounts receivable aging report — who owes what and how overdue.", icon: "DollarSign", category: "AR" },
      { title: "Bills due", prompt: "What bills are due this week? Show amounts and vendors.", icon: "FileText", category: "AP" },
      { title: "Payroll check", prompt: "Run a payroll pre-check — flag any missing hours, overtime issues, or ESA compliance concerns.", icon: "Users", category: "Payroll" },
      { title: "Bank reconciliation", prompt: "Help me reconcile recent bank transactions with QuickBooks entries.", icon: "CreditCard", category: "Banking" },
    ],
  },
  "ben@rebar.shop": {
    agentKey: "estimating",
    userRole: "estimator",
    heroText: "How can **Gauge** help you today?",
    quickActions: [
      { title: "Open takeoffs", prompt: "Show me all open takeoff sessions and their status — pending reviews, QC flags, and deadlines.", icon: "FileText", category: "Estimating" },
      { title: "QC flags", prompt: "Show me all QC flags and validation warnings across active estimates.", icon: "AlertTriangle", category: "QC" },
      { title: "Create a quote", prompt: "Help me create a new quote for a customer. Walk me through the process step by step.", icon: "FileText", category: "Estimating" },
      { title: "Drawing revisions", prompt: "Show me any drawing revisions that need my review or re-estimation.", icon: "RefreshCw", category: "Estimating" },
    ],
  },
};

export function getUserAgentMapping(email?: string | null): UserAgentMapping | null {
  if (!email) return null;
  return userAgentMappings[email.toLowerCase()] || null;
}

export function getUserPrimaryAgent(email?: string | null): AgentConfig | null {
  const mapping = getUserAgentMapping(email);
  if (!mapping) return null;
  return agentConfigs[mapping.agentKey] || null;
}

export function getUserPrimaryAgentKey(email?: string | null): string | null {
  const mapping = getUserAgentMapping(email);
  return mapping?.agentKey || null;
}
