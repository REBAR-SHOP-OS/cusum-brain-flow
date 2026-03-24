import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useGrammarCheck() {
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();

  const check = useCallback(async (text: string): Promise<{ corrected: string; changed: boolean }> => {
    if (!text || text.trim().length < 3) {
      return { corrected: text, changed: false };
    }

    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("grammar-check", {
        body: { text },
      });

      if (error) throw error;

      if (data?.changed) {
        toast({ title: "✅ Text corrected", description: "Grammar and spelling have been fixed." });
        return { corrected: data.corrected, changed: true };
      } else {
        toast({ title: "✨ Looks good!", description: "No issues found." });
        return { corrected: text, changed: false };
      }
    } catch (err) {
      console.error("grammar-check error:", err);
      toast({
        title: "Check failed",
        description: "Could not reach grammar checker. Try again.",
        variant: "destructive",
      });
      return { corrected: text, changed: false };
    } finally {
      setChecking(false);
    }
  }, [toast]);

  return { check, checking };
}
