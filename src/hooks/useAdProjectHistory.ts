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
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as AdProjectRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

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

      const row: any = {
        user_id: user.id,
        name: project.name,
        brand_name: project.brandName ?? null,
        script: project.script ?? null,
        segments: JSON.parse(JSON.stringify(project.segments ?? [])),
        storyboard: JSON.parse(JSON.stringify(project.storyboard ?? [])),
        clips: JSON.parse(JSON.stringify(project.clips ?? [])),
        continuity: project.continuity ? JSON.parse(JSON.stringify(project.continuity)) : null,
        final_video_url: project.finalVideoUrl ?? null,
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
