import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface CommandResult {
  intent: string;
  params: Record<string, string>;
  result: string;
  message: string;
}

export function useCommandHandler() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);

  const executeCommand = useCallback(
    async (input: string): Promise<CommandResult | null> => {
      if (!input.trim()) return null;
      setIsProcessing(true);

      try {
        const { data, error } = await supabase.functions.invoke("handle-command", {
          body: { input },
        });

        if (error) {
          toast.error("Command failed: " + error.message);
          setIsProcessing(false);
          return null;
        }

        const result = data as CommandResult;
        setLastResult(result);

        // Auto-navigate if intent is navigation
        if (result.intent === "navigate" && result.params.page) {
          navigate(result.params.page);
          toast.success(result.message);
        } else if (result.result === "executed") {
          // Show result as info
        } else if (result.result === "failed") {
          toast.error(result.message);
        }

        setIsProcessing(false);
        return result;
      } catch (e) {
        toast.error("Failed to process command");
        setIsProcessing(false);
        return null;
      }
    },
    [navigate]
  );

  return { executeCommand, isProcessing, lastResult };
}
