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
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const { data, error } = await supabase.functions.invoke("auto-generate-post", {
        body: {
          platforms: options?.platforms ?? ["facebook", "instagram", "linkedin"],
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
        return null;
      }

      toast({
        title: "Posts generated! 🎨",
        description: data.message || `${data.postsCreated} post(s) ready for your approval.`,
      });

      // Refresh posts list
      queryClient.invalidateQueries({ queryKey: ["social_posts"] });

      return data;
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = err instanceof DOMException && err.name === "AbortError";
      const message = isTimeout
        ? "Generation timed out — please try again with fewer platforms."
        : err instanceof Error ? err.message : "Failed to generate posts";
      toast({
        title: isTimeout ? "Timeout" : "Generation error",
        description: message,
        variant: "destructive",
      });
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return { generatePosts, generating };
}
