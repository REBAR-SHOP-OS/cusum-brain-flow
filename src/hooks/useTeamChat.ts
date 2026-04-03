import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo } from "react";
import { useProfiles, type Profile } from "@/hooks/useProfiles";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface TeamChannel {
  id: string;
  name: string;
  description: string | null;
  channel_type: string;
  company_id?: string | null;
  created_at: string;
}

export interface ChatAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface TeamMessage {
  id: string;
  channel_id: string;
  sender_profile_id: string;
  original_text: string;
  original_language: string;
  translations: Record<string, string>;
  attachments: ChatAttachment[];
  reply_to_id: string | null;
  created_at: string;
  sender?: Profile;
}

export function useTeamChannels() {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["team-channels", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const query = supabase
        .from("team_channels")
        .select("*")
        .order("created_at", { ascending: true });

      const { data, error } = await (companyId
        ? query.eq("company_id", companyId)
        : query);
      if (error) throw error;
      return (data || []) as TeamChannel[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!user || !companyId) return;

    const channelId = `team-channels-live-${companyId}-${user.id}-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_channels",
          filter: `company_id=eq.${companyId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["team-channels", companyId] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, user, queryClient]);

  return { channels: data ?? [], isLoading };
}

export function useTeamMessages(channelId: string | null) {
  const { user } = useAuth();
  const { profiles } = useProfiles();
  const queryClient = useQueryClient();

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const p of profiles) map.set(p.id, p);
    return map;
  }, [profiles]);

  const { data, isLoading } = useQuery({
    queryKey: ["team-messages", channelId],
    enabled: !!user && !!channelId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("team_messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data || []) as TeamMessage[];
    },
  });

  // Enrich with sender profiles
  const messages = useMemo(() => {
    return (data ?? []).map((m) => ({
      ...m,
      sender: profileMap.get(m.sender_profile_id),
    }));
  }, [data, profileMap]);

  // Realtime
  useEffect(() => {
    if (!user || !channelId) return;
    const channel = supabase
      .channel(`team-msgs-${channelId}-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "team_messages",
        filter: `channel_id=eq.${channelId}` },
        () => queryClient.invalidateQueries({ queryKey: ["team-messages", channelId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, channelId, queryClient]);

  return { messages, isLoading };
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      senderProfileId,
      text,
      senderLang,
      targetLangs,
      attachments = [],
      replyToId,
    }: {
      channelId: string;
      senderProfileId: string;
      text: string;
      senderLang: string;
      targetLangs: string[];
      attachments?: ChatAttachment[];
      replyToId?: string | null;
    }) => {
      // Get translations from edge function
      let translations: Record<string, string> = {};
      const uniqueTargets = [...new Set(targetLangs.filter((l) => l !== senderLang))];

      if (uniqueTargets.length > 0) {
        try {
          const { data, error } = await supabase.functions.invoke("translate-message", {
            body: { text, sourceLang: senderLang, targetLangs: uniqueTargets },
          });
          if (!error && data?.translations) {
            translations = data.translations;
          }
        } catch (e) {
          console.error("Translation failed, sending without:", e);
        }
      }

      // Insert the message
      const { error: insertError } = await (supabase as any)
        .from("team_messages")
        .insert({
          channel_id: channelId,
          sender_profile_id: senderProfileId,
          original_text: text,
          original_language: senderLang,
          translations,
          attachments,
          reply_to_id: replyToId || null,
        });

      if (insertError) throw insertError;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["team-messages", vars.channelId] });
    },
  });
}

export function useMyProfile() {
  const { user } = useAuth();
  const { profiles } = useProfiles();
  return useMemo(() => {
    if (!user) return null;
    return profiles.find((p) => p.user_id === user.id) || null;
  }, [user, profiles]);
}
