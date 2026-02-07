import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyProfile } from "@/hooks/useTeamChat";

export function useCreateChannel() {
  const { user } = useAuth();
  const myProfile = useMyProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      description,
      memberIds,
    }: {
      name: string;
      description: string;
      memberIds: string[];
    }) => {
      if (!user || !myProfile) throw new Error("Not authenticated");

      // Create the channel
      const { data: channel, error: channelErr } = await (supabase as any)
        .from("team_channels")
        .insert({
          name,
          description: description || null,
          channel_type: "group",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (channelErr) throw channelErr;

      // Make sure creator is included in members
      const allMemberIds = new Set(memberIds);
      allMemberIds.add(myProfile.id);

      // Add all members
      const memberRows = [...allMemberIds].map((profileId) => ({
        channel_id: channel.id,
        profile_id: profileId,
      }));

      const { error: membersErr } = await (supabase as any)
        .from("team_channel_members")
        .insert(memberRows);

      if (membersErr) throw membersErr;

      return channel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-channels"] });
    },
  });
}

export function useDeleteChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      // Delete members first
      const { error: membersErr } = await (supabase as any)
        .from("team_channel_members")
        .delete()
        .eq("channel_id", channelId);
      if (membersErr) throw membersErr;

      // Delete messages
      const { error: msgsErr } = await (supabase as any)
        .from("team_messages")
        .delete()
        .eq("channel_id", channelId);
      if (msgsErr) throw msgsErr;

      // Delete channel
      const { error: chErr } = await (supabase as any)
        .from("team_channels")
        .delete()
        .eq("id", channelId);
      if (chErr) throw chErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-channels"] });
    },
  });
}
