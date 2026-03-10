import { supabase } from "@/integrations/supabase/client";

interface SchedulePostParams {
  post_id: string;
  scheduled_date: string;
  qa_status?: string;
  status?: string;
  platform?: string;
  page_name?: string | null;
  extra_combos?: { platform: string; page: string }[];
}

interface SchedulePostResult {
  success: boolean;
  post?: { id: string; status: string; qa_status: string; scheduled_date: string };
  cloned_ids?: string[];
  error?: string;
  details?: string;
}

export async function schedulePost(params: SchedulePostParams): Promise<SchedulePostResult> {
  console.log("[schedulePost] Calling edge function with:", JSON.stringify(params));

  try {
    const { data, error } = await supabase.functions.invoke("schedule-post", {
      body: params,
    });

    if (error) {
      console.error("[schedulePost] Edge function invoke error:", error);
      // Fall through to direct DB update
    } else if (data?.error) {
      console.error("[schedulePost] Server returned error:", data.error, data.details);
      // Fall through to direct DB update
    } else if (data?.success) {
      console.log("[schedulePost] Success via edge function:", JSON.stringify(data));
      return data as SchedulePostResult;
    }
  } catch (e) {
    console.error("[schedulePost] Edge function exception:", e);
  }

  // Fallback: direct DB update if edge function failed
  console.warn("[schedulePost] Edge function failed — falling back to direct DB update");
  try {
    const { data: updated, error: updateErr } = await supabase
      .from("social_posts")
      .update({
        status: params.status || "scheduled",
        qa_status: params.qa_status || "scheduled",
        scheduled_date: params.scheduled_date,
        ...(params.platform ? { platform: params.platform } : {}),
        ...(params.page_name ? { page_name: params.page_name } : {}),
      })
      .eq("id", params.post_id)
      .select("id, status, qa_status, scheduled_date")
      .single();

    if (updateErr) {
      console.error("[schedulePost] Direct update failed:", updateErr.message);
      return { success: false, error: updateErr.message, details: updateErr.details };
    }

    if (!updated) {
      return { success: false, error: "Post not found or update blocked by policy" };
    }

    console.log("[schedulePost] Direct update SUCCESS:", JSON.stringify(updated));
    return { success: true, post: updated };
  } catch (fallbackErr) {
    const msg = fallbackErr instanceof Error ? fallbackErr.message : "Unknown fallback error";
    console.error("[schedulePost] Fallback exception:", msg);
    return { success: false, error: msg };
  }
}
