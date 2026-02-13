import { supabase } from "@/integrations/supabase/client";

/**
 * Reports an unrecoverable error to Vizzy's fix request queue.
 * Called automatically by SmartErrorBoundary and useGlobalErrorHandler
 * when auto-fix fails after max retries.
 */
export async function reportToVizzy(description: string, affectedArea: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Deduplicate: don't report the same error within 5 minutes
    const dedupeKey = `vizzy_report:${affectedArea}:${description.slice(0, 80)}`;
    const lastReport = sessionStorage.getItem(dedupeKey);
    if (lastReport && Date.now() - Number(lastReport) < 5 * 60 * 1000) return;

    await supabase.from("vizzy_fix_requests" as any).insert({
      user_id: user.id,
      description: `🤖 Auto-detected: ${description}`.slice(0, 500),
      affected_area: affectedArea.slice(0, 100),
      status: "open",
    } as any);

    sessionStorage.setItem(dedupeKey, String(Date.now()));
    console.info("[VizzyAutoReport] Reported to Vizzy:", affectedArea, description.slice(0, 80));
  } catch (err) {
    // Fail silently — reporting errors should never cause more errors
    console.warn("[VizzyAutoReport] Failed to report:", err);
  }
}
