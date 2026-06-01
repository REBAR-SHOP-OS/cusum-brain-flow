import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const PLACEHOLDER_TIMES = [
  { hour: 6, minute: 30 },
  { hour: 7, minute: 30 },
  { hour: 8, minute: 0 },
  { hour: 12, minute: 30 },
  { hour: 14, minute: 30 },
];

function buildScheduledDate(baseDate: string, hour: number, minute: number): string {
  // Accept either "YYYY-MM-DD" (treat as calendar date — no UTC shift) or a full ISO timestamp.
  let year: number, month: number, day: number;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseDate);
  if (dateOnly) {
    year = +dateOnly[1];
    month = +dateOnly[2];
    day = +dateOnly[3];
  } else {
    const d = new Date(baseDate);
    year = d.getFullYear();
    month = d.getMonth() + 1;
    day = d.getDate();
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mi = String(minute).padStart(2, "0");
  const eastern = new Date(`${year}-${mm}-${dd}T${hh}:${mi}:00-04:00`);
  return eastern.toISOString();
}

export function useAutoGenerate() {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generatePosts = async (options?: {
    platforms?: string[];
    themes?: string[];
    customInstructions?: string;
    scheduledDate?: string;
    mode?: "story" | "post";
    product?: string;
    aspectRatio?: "9:16" | "1:1" | "4:5" | "16:9";
  }) => {
    setGenerating(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const pollTimers: ReturnType<typeof setTimeout>[] = [];
    const schedulePoll = () => {
      [5000, 15000, 30000].forEach((delay) => {
        pollTimers.push(
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["social_posts"] });
          }, delay)
        );
      });
    };

    try {
      // Get current user
      const user = await getCurrentUser();
      if (!user) throw new Error("Not authenticated");

      const postDate = options?.scheduledDate || new Date().toISOString();

      const isStory = options?.mode === "story";
      const storyProduct = options?.product ?? "";
      // For story mode, only 9:16 keeps the "story" content_type (Story 9:16 hard rule).
      // Other ratios produce regular feed posts at the chosen aspect.
      const aspectRatio = options?.aspectRatio ?? (isStory ? "9:16" : undefined);
      const isStoryRatio = isStory && aspectRatio === "9:16";

      // Phase 0: Insert 5 placeholder "?" cards immediately
      const placeholderRows = PLACEHOLDER_TIMES.map((slot) => ({
        user_id: user.id,
        platform: "unassigned" as const,
        title: isStory ? storyProduct || "Story" : "?",
        content: "",
        hashtags: [] as string[],
        image_url: null,
        status: "draft" as const,
        content_type: isStoryRatio ? "story" : null,
        scheduled_date: buildScheduledDate(postDate, slot.hour, slot.minute),
      }));

      const { data: placeholders, error: phError } = await supabase
        .from("social_posts")
        .insert(placeholderRows)
        .select("id");

      if (phError) {
        console.warn("[useAutoGenerate] Placeholder insert failed:", phError.message);
      }

      const placeholderIds = (placeholders || []).map((p: any) => p.id);

      // Show placeholders in calendar immediately
      queryClient.invalidateQueries({ queryKey: ["social_posts"] });

      // For story + 9:16, fan out one short-lived regenerate-post call per
      // placeholder instead of relying on auto-generate-post's fragile
      // EdgeRuntime.waitUntil background batch (which can be evicted mid-flight,
      // leaving cards empty). Each placeholder gets its own isolate.
      if (isStoryRatio && placeholderIds.length > 0) {
        clearTimeout(timeout);

        const SLOT_VARIATIONS = [
          { angle: "Realistic workshop/fabrication shop interior, sparks flying, industrial atmosphere", lighting: "warm tungsten lighting", palette: "industrial steel grays with orange spark highlights", headline: `${storyProduct} — Built To Spec` },
          { angle: "Active construction site hero shot, low-angle dramatic perspective", lighting: "golden hour natural light", palette: "warm earth tones with structural blues", headline: `Trusted ${storyProduct} Supplier` },
          { angle: "Real product photography in actual warehouse environment, clean wide shot", lighting: "soft overcast daylight from skylights", palette: "cool steel grays, brand red accents", headline: `Quality ${storyProduct} — Fast Delivery` },
          { angle: "Macro close-up of real steel components, extreme detail, shallow depth of field", lighting: "directional studio key light with rim", palette: "monochrome steel with deep shadows", headline: `Premium ${storyProduct}` },
          { angle: "Aerial / overhead flat-lay of organized rebar stock", lighting: "even bright daylight, no harsh shadows", palette: "neutral concrete grays with brand accent", headline: `${storyProduct} In Stock Today` },
        ];

        const results = await Promise.allSettled(
          placeholderIds.map((phId: string, idx: number) =>
            supabase.functions.invoke("regenerate-post", {
              body: {
                post_id: phId,
                image_only: true,
                story_mode: true,
                product: storyProduct,
                variation_hint: SLOT_VARIATIONS[idx % SLOT_VARIATIONS.length],
              },
            })
          )
        );

        let ok = 0;
        let failed = 0;
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const phId = placeholderIds[i];
          const success = r.status === "fulfilled" && !r.value.error && !(r.value.data as any)?.error;
          if (success) {
            ok++;
          } else {
            failed++;
            const errMsg = r.status === "rejected" ? r.reason : (r.value as any)?.error?.message || (r.value.data as any)?.error;
            console.warn(`[useAutoGenerate] story slot ${i} (${phId}) failed:`, errMsg);
            await supabase.from("social_posts").delete().eq("id", phId).select("id");
          }
          queryClient.invalidateQueries({ queryKey: ["social_posts"] });
        }

        toast({
          title: ok > 0 ? "Stories generated! 🎨" : "Story generation failed",
          description: failed > 0
            ? `${ok} of ${placeholderIds.length} story image(s) ready. ${failed} failed and were removed.`
            : `${ok} story image(s) ready for your approval.`,
          variant: ok > 0 ? "default" : "destructive",
        });

        schedulePoll();
        return { success: ok > 0, postsCreated: ok, mode: "story", product: storyProduct };
      }

      // Phase 1: Call edge function with placeholder IDs
      const { data, error } = await supabase.functions.invoke("auto-generate-post", {
        body: {
          platforms: options?.platforms ?? ["unassigned"],
          themes: options?.themes ?? [],
          customInstructions: options?.customInstructions ?? "",
          scheduledDate: options?.scheduledDate,
          placeholderIds,
          mode: options?.mode ?? "post",
          product: storyProduct,
          aspectRatio,
        },
      });
      clearTimeout(timeout);

      if (error) throw new Error(error.message);


      if (data?.error) {
        toast({
          title: "Generation failed",
          description: data.error,
          variant: "destructive",
        });
        schedulePoll();
        return null;
      }

      toast({
        title: "Posts generated! 🎨",
        description: data.message || `${data.postsCreated} post(s) ready for your approval.`,
      });

      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
      schedulePoll();

      return data;
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = err instanceof DOMException && err.name === "AbortError";
      const message = isTimeout
        ? "Generation is taking longer than expected — posts will appear shortly."
        : err instanceof Error ? err.message : "Failed to generate posts";
      toast({
        title: isTimeout ? "Still processing…" : "Generation error",
        description: message,
        variant: isTimeout ? "default" : "destructive",
      });

      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
      schedulePoll();

      return null;
    } finally {
      setGenerating(false);
    }
  };

  return { generatePosts, generating };
}
