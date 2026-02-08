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
    try {
      const { data, error } = await supabase.functions.invoke("auto-generate-post", {
        body: {
          platforms: options?.platforms ?? ["facebook", "instagram"],
          themes: options?.themes ?? [],
          customInstructions: options?.customInstructions ?? "",
          scheduledDate: options?.scheduledDate,
        },
      });

      if (error) throw new Error(error.message);

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
      const message = err instanceof Error ? err.message : "Failed to generate posts";
      toast({
        title: "Generation error",
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
