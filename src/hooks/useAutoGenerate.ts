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
