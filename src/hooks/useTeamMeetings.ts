import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyProfile } from "@/hooks/useTeamChat";
import { useEffect } from "react";

export interface TeamMeeting {
  id: string;
  channel_id: string;
  title: string;
  room_code: string;
  started_by: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  meeting_type: string;
}

export function useActiveMeetings(channelId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["team-meetings", channelId],
    enabled: !!user && !!channelId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("team_meetings")
        .select("*")
        .eq("channel_id", channelId)
        .eq("status", "active")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data || []) as TeamMeeting[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!user || !channelId) return;
    const channel = supabase
      .channel(`meetings-${channelId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "team_meetings",
        filter: `channel_id=eq.${channelId}`,
      }, () => queryClient.invalidateQueries({ queryKey: ["team-meetings", channelId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, channelId, queryClient]);

  return { meetings: data ?? [], isLoading };
}

export function useStartMeeting() {
  const myProfile = useMyProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      title,
      meetingType,
    }: {
      channelId: string;
      title: string;
      meetingType: "video" | "audio" | "screen_share";
    }) => {
      if (!myProfile) throw new Error("Profile not found");

      const roomCode = `rebar-${channelId.slice(0, 8)}-${Date.now().toString(36)}`;

      const { data, error } = await (supabase as any)
        .from("team_meetings")
        .insert({
          channel_id: channelId,
          title,
          room_code: roomCode,
          started_by: myProfile.id,
          meeting_type: meetingType,
          status: "active",
        })
        .select("*")
        .single();

      if (error) throw error;
      return data as TeamMeeting;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["team-meetings", vars.channelId] });
    },
  });
}

export function useEndMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meetingId: string) => {
      // End the meeting
      const { error } = await (supabase as any)
        .from("team_meetings")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", meetingId);
      if (error) throw error;

      // Trigger AI summarization in background (don't await - fire and forget)
      supabase.functions.invoke("summarize-meeting", {
        body: { meetingId },
      }).then(({ data, error: fnErr }) => {
        if (fnErr) console.error("Meeting summarization failed:", fnErr);
        else console.log("Meeting summarized:", data?.summary?.slice(0, 100));
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-meetings"] });
    },
  });
}
