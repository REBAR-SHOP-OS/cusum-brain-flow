import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SocialPost {
  id: string;
  platform: "facebook" | "instagram" | "linkedin" | "twitter" | "tiktok" | "youtube" | "unassigned";
  status: "published" | "scheduled" | "draft" | "declined" | "pending_approval" | "publishing" | "failed";
  qa_status: "needs_review" | "approved" | "scheduled" | "published";
  title: string;
  content: string;
  image_url: string | null;
  scheduled_date: string | null;
  hashtags: string[];
  user_id: string;
  created_at: string;
  updated_at: string;
  // Engagement metrics
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  // Metadata
  content_type: string | null;
  page_name: string | null;
  // Approval gate
  neel_approved: boolean;
  // Decline
  decline_reason: string | null;
  last_error: string | null;
}

export type SocialPostInsert = Omit<SocialPost, "id" | "created_at" | "updated_at">;

export function useSocialPosts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Realtime: auto-refresh when any team member changes posts
  useEffect(() => {
    const channel = supabase
      .channel("social_posts_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_posts" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["social_posts"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["social_posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_posts")
        .select("*")
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data as SocialPost[];
    },
  });

  const createPost = useMutation({
    mutationFn: async (post: Partial<SocialPostInsert> & { platform: string; user_id: string }) => {
      const { data, error } = await supabase
        .from("social_posts")
        .insert(post)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
      toast({ title: "Post created", description: "Your social media post has been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error creating post", description: err.message, variant: "destructive" });
    },
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SocialPost> & { id: string }) => {
      console.log(`[useSocialPosts] updatePost called — id: ${id}, payload:`, updates);
      const { data, error } = await supabase
        .from("social_posts")
        .update(updates)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) {
        console.error(`[useSocialPosts] updatePost FAILED — id: ${id}, error:`, error.message);
        throw error;
      }
      if (!data) {
        console.error(`[useSocialPosts] updatePost returned NULL data — id: ${id}. RLS blocked or row not found.`);
        throw new Error("Update failed — post not found or permission denied. Check that you have access.");
      }
      console.log(`[useSocialPosts] updatePost SUCCESS — id: ${id}, new status: ${data.status}, qa_status: ${data.qa_status}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error updating post", description: err.message, variant: "destructive" });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("social_posts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
      toast({ title: "Post deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error deleting post", description: err.message, variant: "destructive" });
    },
  });

  return { posts: posts ?? [], isLoading, createPost, updatePost, deletePost };
}
