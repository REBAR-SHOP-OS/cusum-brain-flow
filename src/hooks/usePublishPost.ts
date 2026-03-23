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
    content_type?: string;
    cover_image_url?: string | null;
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
      const contentHasHashtags = /#[a-zA-Z]\w/.test(cleanContent);
      const message = contentHasHashtags
        ? cleanContent
        : [cleanContent, post.hashtags.length > 0 ? "\n\n" + post.hashtags.join(" ") : ""].join("");

      // Use raw fetch with 120s timeout so client doesn't abort before server-side
      // video polling completes (Instagram Reels can take 60-90s to process)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-publish`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          platform: post.platform,
          message,
          image_url: post.image_url,
          post_id: post.id,
          page_name: post.page_name,
          force_publish: true,
          content_type: post.content_type || "post",
          cover_image_url: post.cover_image_url || undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new Error(`Server returned non-JSON response (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(data?.error || `Publish failed (${response.status})`);
      }
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Published!",
        description: `Post published to ${post.platform} successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
      return true;
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      const msg = isTimeout
        ? "Publishing is taking longer than expected — the post may still publish. Check back shortly."
        : err?.message || "Failed to publish post";
      toast({
        title: isTimeout ? "Still processing…" : "Publish failed",
        description: msg,
        variant: isTimeout ? "default" : "destructive",
      });
      if (isTimeout) {
        // Server may still succeed — poll for update
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["social_posts"] }), 10000);
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["social_posts"] }), 30000);
      }
      return false;
    } finally {
      setPublishing(false);
    }
  };

  return { publishPost, publishing };
}
