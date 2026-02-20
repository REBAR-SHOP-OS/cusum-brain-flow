import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SocialPost {
  id: string;
  platform: "facebook" | "instagram" | "linkedin" | "twitter" | "tiktok" | "youtube";
  status: "published" | "scheduled" | "draft" | "declined" | "pending_approval";
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
}

export type SocialPostInsert = Omit<SocialPost, "id" | "created_at" | "updated_at">;

export function useSocialPosts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      const { data, error } = await supabase
        .from("social_posts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
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
