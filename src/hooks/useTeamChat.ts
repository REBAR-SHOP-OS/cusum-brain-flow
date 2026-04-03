import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo } from "react";
import { useProfiles, type Profile } from "@/hooks/useProfiles";

export interface TeamChannel {
  id: string;
  name: string;
  description: string | null;
  channel_type: string;
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

type TeamChannelRow = Database["public"]["Tables"]["team_channels"]["Row"];
type TeamMessageRow = Database["public"]["Tables"]["team_messages"]["Row"];
type TeamMessageInsert = Database["public"]["Tables"]["team_messages"]["Insert"];

/** Coerce DB rows so UI never throws on null/legacy shapes. Exported for unit tests. */
export function normalizeTeamMessageRow(m: Record<string, unknown>): TeamMessage {
  const rawTranslations = m.translations;
  const translations: Record<string, string> = {};
  if (rawTranslations && typeof rawTranslations === "object" && !Array.isArray(rawTranslations)) {
    for (const [k, v] of Object.entries(rawTranslations as Record<string, unknown>)) {
      if (typeof v === "string") translations[k] = v;
    }
  }

  const rawAttachments = m.attachments;
  const attachments: ChatAttachment[] = Array.isArray(rawAttachments)
    ? (rawAttachments as ChatAttachment[]).filter(
        (a) => a && typeof a === "object" && typeof (a as ChatAttachment).url === "string"
      )
    : [];

  const originalText =
    m.original_text == null ? "" : typeof m.original_text === "string" ? m.original_text : String(m.original_text);

  return {
    id: String(m.id ?? ""),
    channel_id: String(m.channel_id ?? ""),
    sender_profile_id: String(m.sender_profile_id ?? ""),
    original_text: originalText,
    original_language:
      m.original_language == null
        ? "en"
        : typeof m.original_language === "string"
          ? m.original_language
          : String(m.original_language),
    translations,
    attachments,
    reply_to_id: m.reply_to_id == null ? null : String(m.reply_to_id),
    created_at:
      m.created_at == null ? new Date(0).toISOString() : typeof m.created_at === "string" ? m.created_at : String(m.created_at),
  };
}

export function useTeamChannels() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["team-channels", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_channels")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data || []) as TeamChannelRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        channel_type: row.channel_type,
        created_at: row.created_at,
      }));
    },
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`team-channels-live-${user?.id || "global"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_channels" },
        () => queryClient.invalidateQueries({ queryKey: ["team-channels", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

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
    queryKey: ["team-messages", user?.id, channelId],
    enabled: !!user && !!channelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return ((data || []) as TeamMessageRow[]).map((row) =>
        normalizeTeamMessageRow(row as unknown as Record<string, unknown>)
      );
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
      .channel(`team-msgs-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "team_messages",
        filter: `channel_id=eq.${channelId}` },
        () => queryClient.invalidateQueries({ queryKey: ["team-messages", user.id, channelId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, channelId, queryClient]);

  return { messages, isLoading };
}

export function useSendMessage() {
  const { user } = useAuth();
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
      const payload: TeamMessageInsert = {
        channel_id: channelId,
        sender_profile_id: senderProfileId,
        original_text: text,
        original_language: senderLang,
        translations,
        attachments,
        reply_to_id: replyToId || null,
      };
      const { error: insertError } = await supabase
        .from("team_messages")
        .insert(payload);

      if (insertError) throw insertError;
    },
    onSuccess: (_, vars) => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["team-messages", user.id, vars.channelId] });
      }
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
