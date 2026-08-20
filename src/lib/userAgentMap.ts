import { agentConfigs, AgentConfig } from "@/components/agent/agentConfigs";
import {
  getUserPrimaryAgentKeyFromConfig,
  getUserHeroText,
  getUserQuickActions,
  getVisibleAgents,
} from "@/lib/userAccessConfig";

interface UserAgentMapping {
  agentKey: string;
  userRole: string;
  quickActions: { title: string; prompt: string; icon: string; category: string }[];
  heroText: string;
}

export function getUserAgentMapping(email?: string | null): UserAgentMapping | null {
  if (!email) return null;
  const primaryKey = getUserPrimaryAgentKeyFromConfig(email);
  if (!primaryKey) return null;

  const config = agentConfigs[primaryKey];
  return {
    agentKey: primaryKey,
    userRole: config?.role ?? "",
    quickActions: getUserQuickActions(email),
    heroText: getUserHeroText(email) ?? `How can **${config?.name ?? primaryKey}** help you today?`,
  };
}

export function getUserPrimaryAgent(email?: string | null): AgentConfig | null {
  const key = getUserPrimaryAgentKeyFromConfig(email);
  if (!key) return null;
  return agentConfigs[key] || null;
}

export function getUserPrimaryAgentKey(email?: string | null): string | null {
  return getUserPrimaryAgentKeyFromConfig(email);
}
