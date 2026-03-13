import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

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
    // 120s timeout — edge function generates 5 images which can take 60-80s
    const timeout = setTimeout(() => controller.abort(), 120000);

    // Schedule polling re-fetches regardless of outcome
    // Images may finish uploading after the initial response
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
      const { data, error } = await supabase.functions.invoke("auto-generate-post", {
        body: {
          platforms: options?.platforms ?? ["unassigned"],
          themes: options?.themes ?? [],
          customInstructions: options?.customInstructions ?? "",
          scheduledDate: options?.scheduledDate,
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
        // Still poll — posts may have been partially created
        schedulePoll();
        return null;
      }

      toast({
        title: "Posts generated! 🎨",
        description: data.message || `${data.postsCreated} post(s) ready for your approval.`,
      });

      // Refresh posts list immediately + schedule polls for late image uploads
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

      // On timeout, the server is still working — poll for results
      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
      schedulePoll();

      return null;
    } finally {
      setGenerating(false);
    }
  };

  return { generatePosts, generating };
}
