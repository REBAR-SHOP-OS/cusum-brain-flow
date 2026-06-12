import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeForInstagram } from "@/lib/igSafeVideo";
import { uploadSocialMediaAsset } from "@/lib/socialMediaStorage";

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
        .select("status, page_results")
        .eq("id", post.id)
        .single();

      const pageResults = Array.isArray(current?.page_results)
        ? current.page_results as Array<{ status?: string }>
        : [];
      const hasFailedPages = pageResults.some((page) => page?.status === "failed");
      if (current?.status === "published" && !hasFailedPages) {
        toast({ title: "Already published", description: "This post has already been published.", variant: "destructive" });
        return false;
      }
      // Pre-flight: Instagram cannot publish WebM/MOV/etc — reject early with a
      // clear actionable message instead of relying on Meta's generic rejection.
      if (post.platform === "instagram" && post.image_url) {
        const url = post.image_url;
        let badByUrl = /\.(webm|mkv|mov|avi|wmv)(\?|$)/i.test(url);
        let badByType = false;
        let headContentType = "";
        if (!badByUrl) {
          try {
            const head = await fetch(url, { method: "HEAD" });
            headContentType = (head.headers.get("content-type") || "").toLowerCase();
            badByType =
              headContentType.includes("webm") ||
              headContentType.includes("matroska") ||
              headContentType.includes("quicktime") ||
              headContentType.includes("x-msvideo") ||
              headContentType.includes("x-ms-wmv");
          } catch {
            // Network/CORS failure — let the server-side guard handle it.
          }
        }
        if (badByUrl || badByType) {
          toast({
            title: "Video not Instagram-ready",
            description:
              "This file is WebM (browser-recorded). Re-render it as MP4 (H.264 + AAC) from Pro Editor, or upload an MP4, then publish again.",
            variant: "destructive",
            duration: 12000,
          });
          return false;
        }

        // Root-cause auto-heal: only run video normalization when the asset is
        // actually a video. `content_type === "story"` covers BOTH image and
        // video stories, so it must NOT force the video pipeline — that's what
        // caused "Preparing video for Instagram…" to appear on image stories.
        const urlIsVideo = /\.(mp4|m4v|mov|webm|mkv)(\?|$)/i.test(url);
        const headIsVideo = headContentType.startsWith("video/");
        const urlIsImage = /\.(png|jpe?g|webp|gif|heic|heif)(\?|$)/i.test(url);
        const headIsImage = headContentType.startsWith("image/");
        const isImage = !urlIsVideo && !headIsVideo && (urlIsImage || headIsImage);
        // Reels are always video; stories can be either — only treat as video
        // when explicit signal says so.
        const looksLikeVideo =
          !isImage && (urlIsVideo || headIsVideo || post.content_type === "reel");
        if (looksLikeVideo) {
          try {
            toast({
              title: "Preparing video for Instagram…",
              description: "Re-encoding to Reels-safe spec (30 fps, H.264 level 4.1).",
            });
            const norm = await normalizeForInstagram(url);
            const normMime = (norm.blob?.type || "").toLowerCase();
            if (norm.reencoded && normMime.startsWith("video/")) {
              const newUrl = await uploadSocialMediaAsset(
                URL.createObjectURL(norm.blob),
                "video",
              );
              await supabase
                .from("social_posts")
                .update({ image_url: newUrl })
                .eq("id", post.id);
              post.image_url = newUrl;
              console.log("[publish] swapped IG video for normalized version", newUrl);
            }
          } catch (e) {
            console.warn("[publish] IG normalization failed, continuing with original", e);
          }
        }
      }


      // Strip Persian translation block — never publish Persian text
      const cleanContent = stripPersian(post.content);
      const contentHasHashtags = /#[a-zA-Z]\w/.test(cleanContent);
      const message = contentHasHashtags
        ? cleanContent
        : [cleanContent, post.hashtags.length > 0 ? "\n\n" + post.hashtags.join(" ") : ""].join("");


      if (post.platform === "linkedin") {
        const { data: linkedInStatus, error: linkedInStatusError } = await supabase.functions.invoke("linkedin-oauth", {
          body: { action: "check-status" },
        });

        if (linkedInStatusError) {
          throw new Error(linkedInStatusError.message);
        }

        if (linkedInStatus?.status === "error") {
          // Inline Reconnect — open LinkedIn OAuth in a new tab. Use scopeMode:"personal"
          // because the current LinkedIn App is NOT approved for offline_access / org
          // scopes, and requesting the full set returns invalid_scope_error from LinkedIn
          // (verified in linkedin-oauth logs). Personal scope set is known-good and at
          // least restores personal-page publishing immediately.
          try {
            const { data: authData } = await supabase.functions.invoke("linkedin-oauth", {
              body: { action: "get-auth-url", returnUrl: window.location.origin, scopeMode: "personal" },
            });
            if (authData?.authUrl) {
              window.open(authData.authUrl, "_blank", "noopener,noreferrer");
            }
          } catch (e) {
            console.warn("[publish] Could not auto-open LinkedIn reconnect:", e);
          }
          throw new Error(linkedInStatus.error || "Reconnect LinkedIn from Settings → Integrations.");
        }
      }

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

      const publishedCount = Array.isArray(data?.pages) ? data.pages.length : 0;
      const failedCount = Array.isArray(data?.errors) ? data.errors.length : 0;
      toast({
        title: failedCount > 0 ? "Partially published" : "Published!",
        description: failedCount > 0
          ? `${publishedCount} page(s) published, ${failedCount} still need retry.`
          : `Post published to ${post.platform} successfully.`,
        variant: failedCount > 0 ? "destructive" : undefined,
        duration: failedCount > 0 ? 12000 : undefined,
      });

      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
      return true;
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      const msg = isTimeout
        ? "Publishing is taking longer than expected — the post may still publish. Check back shortly."
        : err?.message || "Failed to publish post";
      const isLinkedInScopeIssue = /Marketing Developer Platform|offline_access|w_organization_social|r_organization_social/i
        .test(msg);
      toast({
        title: isTimeout ? "Still processing…" : "Publish failed",
        description: msg,
        variant: isTimeout ? "default" : "destructive",
        duration: isLinkedInScopeIssue ? 15000 : undefined,
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
