import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget call to analyze-feedback-fix edge function.
 * Silently generates a Lovable patch command from feedback and saves to vizzy_memory.
 */
export function triggerFeedbackAnalysis(params: {
  title: string;
  description: string;
  screenshot_url?: string;
  page_path?: string;
  reopen_reason?: string;
  original_task_id?: string;
}) {
  // Fire and forget — don't await, don't block UI
  supabase.functions.invoke("analyze-feedback-fix", {
    body: params,
  }).then(({ error }) => {
    if (error) console.warn("[FeedbackAnalysis] Failed:", error.message);
    else console.log("[FeedbackAnalysis] Patch generated for:", params.title);
  }).catch((err) => {
    console.warn("[FeedbackAnalysis] Network error:", err);
  });
}
