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
    heroText: "How can your **CEO Command** help you today?",
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
