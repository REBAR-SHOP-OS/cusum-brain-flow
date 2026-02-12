import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getUserAgentMapping } from "@/lib/userAgentMap";
import { agentConfigs, type AgentConfig } from "@/components/agent/agentConfigs";

export interface UserAgentData {
  agentCode: string;
  agentName: string;
  agentConfig: AgentConfig | null;
  voiceEnabled: boolean;
  preferredLanguage: string;
  preferredVoiceId: string | null;
  isLoading: boolean;
}

export function useUserAgent(): UserAgentData {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["user-agent", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Try DB first
      const { data: ua } = await supabase
        .from("user_agents" as any)
        .select("agent_id, agents!inner(code, name)")
        .eq("user_id", user!.id)
        .single();

      // Get profile voice settings
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferred_language, preferred_voice_id, voice_enabled")
        .eq("user_id", user!.id)
        .single();

      const agentRow = ua as any;
      const agentCode = agentRow?.agents?.code ?? null;
      const agentName = agentRow?.agents?.name ?? null;

      return {
        agentCode,
        agentName,
        preferredLanguage: (profile as any)?.preferred_language ?? "en",
        preferredVoiceId: (profile as any)?.preferred_voice_id ?? null,
        voiceEnabled: (profile as any)?.voice_enabled ?? false,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fallback to hardcoded map
  const fallback = getUserAgentMapping(user?.email);
  const agentCode = data?.agentCode ?? fallback?.agentKey ?? "assistant";
  const agentName = data?.agentName ?? agentConfigs[agentCode]?.name ?? "Vizzy";

  return {
    agentCode,
    agentName,
    agentConfig: agentConfigs[agentCode] ?? null,
    voiceEnabled: data?.voiceEnabled ?? false,
    preferredLanguage: data?.preferredLanguage ?? "en",
    preferredVoiceId: data?.preferredVoiceId ?? null,
    isLoading,
  };
}
