import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyProfile } from "@/hooks/useTeamChat";
import { toast } from "sonner";

/**
 * Reusable helper: get the current user's company_id from their profile.
 * Uses the already-loaded myProfile when available, falls back to a DB query.
 */
async function resolveCompanyId(
  userId: string,
  myProfile: { company_id?: string } | null
): Promise<string> {
  if (myProfile?.company_id) return myProfile.company_id;

  const { data, error } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();

  if (error || !data?.company_id) {
    throw new Error("Could not resolve your company. Please contact an admin.");
  }
  return data.company_id;
}

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
      if (!myProfile)
        throw new Error(
          "Your profile is not set up yet. Please ask an admin to link your account."
        );

      const companyId = await resolveCompanyId(user.id, myProfile as any);

      // Create the channel
      const { data: channel, error: channelErr } = await (supabase as any)
        .from("team_channels")
        .insert({
          name,
          description: description || null,
          channel_type: "group",
          created_by: user.id,
          company_id: companyId,
        })
        .select("id")
        .single();

      if (channelErr) throw channelErr;

      // Ensure creator is always a member
      const allMemberIds = new Set(memberIds);
      allMemberIds.add(myProfile.id);

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
    }: {
      targetProfileId: string;
      targetName?: string;
    }) => {
      if (!user) throw new Error("Not logged in");
      if (!myProfile)
        throw new Error(
          "Your profile is not set up yet. Please ask an admin to link your account."
        );

      const { data, error } = await supabase.rpc("create_dm_channel" as any, {
        _my_profile_id: myProfile.id,
        _target_profile_id: targetProfileId,
      });

      if (error) {
        const correlationId = Math.random().toString(36).substring(2, 9);
        const companyId = (myProfile as any)?.company_id ?? "unknown";

        console.error("[DM Creation Failed]", {
          correlationId,
          authUserId: user.id,
          my_profile_id: myProfile.id,
          target_profile_id: targetProfileId,
          active_company_id: companyId,
          rpc_name: "create_dm_channel",
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          },
        });

        const userMsg =
          error.message === "new row violates row-level security policy"
            ? `Unable to start this conversation. Please contact an admin. (Ref: ${correlationId})`
            : `DM creation failed: ${error.message} (Ref: ${correlationId})`;

        toast.error(userMsg, {
          description: `Error code: ${error.code ?? "unknown"} · Ref: ${correlationId}`,
          duration: 10000,
        });

        throw new Error(userMsg);
      }

      if (!data) {
        const correlationId = Math.random().toString(36).substring(2, 9);
        const companyId = (myProfile as any)?.company_id ?? "unknown";
        console.error("[DM Creation] RPC returned null", {
          correlationId,
          authUserId: user.id,
          my_profile_id: myProfile.id,
          target_profile_id: targetProfileId,
          active_company_id: companyId,
          rpc_name: "create_dm_channel",
        });
        toast.error(`DM channel was not created. (Ref: ${correlationId})`, { duration: 8000 });
        throw new Error(`DM channel was not created. Please try again. (Ref: ${correlationId})`);
      }

      return { id: data as string, existed: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-channels"] });
    },
  });
}

export function useDeleteChannel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      if (!user) throw new Error("Not logged in");

      // Delete members, messages, then channel
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
