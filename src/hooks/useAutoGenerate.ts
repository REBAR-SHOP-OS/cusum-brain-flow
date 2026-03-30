import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const d = new Date(baseDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const eastern = new Date(
    `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-04:00`
  );
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const postDate = options?.scheduledDate || new Date().toISOString();

      // Phase 0: Insert 5 placeholder "?" cards immediately
      const placeholderRows = PLACEHOLDER_TIMES.map((slot) => ({
        user_id: user.id,
        platform: "unassigned" as const,
        title: "?",
        content: "",
        hashtags: [] as string[],
        image_url: null,
        status: "draft" as const,
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
      console.log("[useAutoGenerate] Created placeholder IDs:", placeholderIds);

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
        },
      });
      clearTimeout(timeout);

      if (error) throw new Error(error.message);

      console.log("[useAutoGenerate] Edge function response:", JSON.stringify(data));

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
