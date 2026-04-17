import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ScriptSegment, StoryboardScene, ContinuityProfile, ClipOutput } from "@/types/adDirector";

export interface AdProjectRow {
  id: string;
  user_id: string;
  name: string;
  brand_name: string | null;
  script: string | null;
  segments: ScriptSegment[];
  storyboard: StoryboardScene[];
  clips: ClipOutput[];
  continuity: ContinuityProfile | null;
  final_video_url: string | null;
  thumbnail_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ["ad_projects"];

export function useAdProjectHistory() {
  const qc = useQueryClient();

  const projects = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("ad_projects")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as AdProjectRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Realtime: any insert/update/delete on ad_projects for this user invalidates the list,
  // so newly created drafts and in-flight generation progress appear immediately.
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const channelName = `ad_projects:${user.id}:${crypto.randomUUID()}`;
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ad_projects", filter: `user_id=eq.${user.id}` },
          () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  const saveProject = useMutation({
    mutationFn: async (project: {
      id?: string;
      name: string;
      brandName?: string;
      script?: string;
      segments?: ScriptSegment[];
      storyboard?: StoryboardScene[];
      clips?: ClipOutput[];
      continuity?: ContinuityProfile | null;
      finalVideoUrl?: string | null;
      status?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Root-cause guard: never persist ephemeral blob: URLs to the database.
      // A blob: URL is only valid in the browser tab that created it — saving it
      // means the next session sees "missing" clips and triggers auto-recovery.
      const sanitizedClips = (project.clips ?? []).map((c) => {
        const url = c.videoUrl;
        if (typeof url === "string" && url.startsWith("blob:")) {
          return { ...c, videoUrl: null, status: "failed" as const, error: "Ephemeral URL discarded — please regenerate" };
        }
        return c;
      });
      const finalUrl = project.finalVideoUrl && project.finalVideoUrl.startsWith("blob:")
        ? null
        : (project.finalVideoUrl ?? null);

      const row: any = {
        user_id: user.id,
        name: project.name,
        brand_name: project.brandName ?? null,
        script: project.script ?? null,
        segments: JSON.parse(JSON.stringify(project.segments ?? [])),
        storyboard: JSON.parse(JSON.stringify(project.storyboard ?? [])),
        clips: JSON.parse(JSON.stringify(sanitizedClips)),
        continuity: project.continuity ? JSON.parse(JSON.stringify(project.continuity)) : null,
        final_video_url: finalUrl,
        status: project.status ?? "draft",
        updated_at: new Date().toISOString(),
      };

      if (project.id) {
        const { error } = await supabase
          .from("ad_projects")
          .update(row)
          .eq("id", project.id);
        if (error) throw error;
        return project.id;
      } else {
        const { data, error } = await supabase
          .from("ad_projects")
          .insert(row)
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ad_projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return { projects, saveProject, deleteProject };
}
