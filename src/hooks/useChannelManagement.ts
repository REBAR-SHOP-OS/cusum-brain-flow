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
      if (!user) throw new Error("Not logged in");
      if (!myProfile) throw new Error("Your profile is not set up yet. Please ask an admin to link your account.");

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

export function useOpenDM() {
  const { user } = useAuth();
  const myProfile = useMyProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      targetProfileId,
      targetName,
    }: {
      targetProfileId: string;
      targetName: string;
    }) => {
      if (!user) throw new Error("Not logged in");
      if (!myProfile) throw new Error("Your profile is not set up yet. Please ask an admin to link your account.");

      // Check if a DM channel already exists between these two users
      const { data: existingMembers } = await (supabase as any)
        .from("team_channel_members")
        .select("channel_id")
        .eq("profile_id", myProfile.id);

      const myChannelIds = (existingMembers || []).map((m: any) => m.channel_id);

      if (myChannelIds.length > 0) {
        // Find DM channels where the target is also a member
        const { data: sharedMembers } = await (supabase as any)
          .from("team_channel_members")
          .select("channel_id")
          .eq("profile_id", targetProfileId)
          .in("channel_id", myChannelIds);

        const sharedChannelIds = (sharedMembers || []).map((m: any) => m.channel_id);

        if (sharedChannelIds.length > 0) {
          // Check if any of these shared channels are DMs
          const { data: dmChannels } = await (supabase as any)
            .from("team_channels")
            .select("id")
            .eq("channel_type", "dm")
            .in("id", sharedChannelIds);

          if (dmChannels && dmChannels.length > 0) {
            return { id: dmChannels[0].id, existed: true };
          }
        }
      }

      // No existing DM — create one
      const dmName = [myProfile.full_name, targetName]
        .sort()
        .join(" & ");

      const { data: channel, error: channelErr } = await (supabase as any)
        .from("team_channels")
        .insert({
          name: dmName,
          channel_type: "dm",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (channelErr) throw channelErr;

      // Add both members
      const { error: membersErr } = await (supabase as any)
        .from("team_channel_members")
        .insert([
          { channel_id: channel.id, profile_id: myProfile.id },
          { channel_id: channel.id, profile_id: targetProfileId },
        ]);

      if (membersErr) throw membersErr;

      return { id: channel.id, existed: false };
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
      const { error: membersErr } = await (supabase as any)
        .from("team_channel_members")
        .delete()
        .eq("channel_id", channelId);
      if (membersErr) throw membersErr;

      const { error: msgsErr } = await (supabase as any)
        .from("team_messages")
        .delete()
        .eq("channel_id", channelId);
      if (msgsErr) throw msgsErr;

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
