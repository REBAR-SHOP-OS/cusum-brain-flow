import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export type AISuggestContextType = "task_description" | "task_comment" | "note" | "email";

interface AISuggestButtonProps {
  /** What type of content to suggest */
  contextType: AISuggestContextType;
  /** Any relevant background context (e.g. task title) */
  context?: string;
  /** Current value of the text field */
  currentText?: string;
  /** Called with the generated suggestion */
  onSuggestion: (text: string) => void;
  /** Optional custom label */
  label?: string;
  /** Small/compact mode */
  compact?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

export function AISuggestButton({
  contextType,
  context,
  currentText,
  onSuggestion,
  label,
  compact = false,
  disabled = false,
}: AISuggestButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSuggest = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-inline-suggest", {
        body: {
          context_type: contextType,
          context: context || "",
          current_text: currentText || "",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.suggestion) {
        onSuggestion(data.suggestion);
        toast({ title: "✨ Suggestion ready", description: "Review and edit before submitting." });
      }
    } catch (err: any) {
      console.error("ai-inline-suggest error:", err);
      toast({
        title: "Suggestion failed",
        description: err.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
        onClick={handleSuggest}
        disabled={disabled || loading}
        title="AI Suggest"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1.5 text-xs h-7 text-primary hover:text-primary hover:bg-primary/10"
      onClick={handleSuggest}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Sparkles className="w-3.5 h-3.5" />
      )}
      {loading ? "Thinking..." : (label ?? "Suggest")}
    </Button>
  );
}
