import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function usePublishPost() {
  const [publishing, setPublishing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const publishPost = async (post: {
    id: string;
    platform: string;
    content: string;
    title: string;
    hashtags: string[];
    image_url: string | null;
  }) => {
    setPublishing(true);
    try {
      const message = [
        post.content,
        post.hashtags.length > 0 ? "\n\n" + post.hashtags.join(" ") : "",
      ].join("");

      const { data, error } = await supabase.functions.invoke("social-publish", {
        body: {
          platform: post.platform,
          message,
          image_url: post.image_url,
          post_id: post.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Published!",
        description: `Post published to ${post.platform} successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
      return true;
    } catch (err: any) {
      const msg = err?.message || "Failed to publish post";
      toast({
        title: "Publish failed",
        description: msg,
        variant: "destructive",
      });
      return false;
    } finally {
      setPublishing(false);
    }
  };

  return { publishPost, publishing };
}
