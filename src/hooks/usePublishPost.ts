import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

/** Strip Persian translation block that is only for internal review */
function stripPersian(text: string): string {
  let t = text;
  const idx = t.indexOf("---PERSIAN---");
  if (idx !== -1) t = t.slice(0, idx);
  t = t.replace(/🖼️\s*متن روی عکس:[\s\S]*/m, "");
  t = t.replace(/📝\s*ترجمه کپشن:[\s\S]*/m, "");
  return t.trim();
}

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
    page_name?: string;
  }) => {
    setPublishing(true);
    try {
      // Guard: prevent duplicate publishing
      const { data: current } = await supabase
        .from("social_posts")
        .select("status")
        .eq("id", post.id)
        .single();

      if (current?.status === "published") {
        toast({ title: "Already published", description: "This post has already been published.", variant: "destructive" });
        return false;
      }

      // Strip Persian translation block — never publish Persian text
      const cleanContent = stripPersian(post.content);
      const message = [
        cleanContent,
        post.hashtags.length > 0 ? "\n\n" + post.hashtags.join(" ") : "",
      ].join("");

      const { data, error } = await supabase.functions.invoke("social-publish", {
        body: {
          platform: post.platform,
          message,
          image_url: post.image_url,
          post_id: post.id,
          page_name: post.page_name,
          force_publish: true,
        },
      });

      if (error) {
        let serverMsg = error.message;
        try {
          if ((error as any).context?.body) {
            const body = await new Response((error as any).context.body).json();
            if (body?.error) serverMsg = body.error;
          }
        } catch {}
        throw new Error(serverMsg);
      }
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
