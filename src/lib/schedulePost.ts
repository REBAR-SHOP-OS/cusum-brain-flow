import { supabase } from "@/integrations/supabase/client";

interface SchedulePostParams {
  post_id: string;
  scheduled_date: string;
  qa_status?: string;
  status?: string;
  platform?: string;
  page_name?: string | null;
  extra_combos?: { platform: string; page: string }[];
  title?: string;
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

  // Frontend duplicate check: same title + platform + same day
  if (params.title && params.platform) {
    const scheduledDay = params.scheduled_date.substring(0, 10); // YYYY-MM-DD
    const { data: dupes } = await supabase
      .from("social_posts")
      .select("id")
      .eq("platform", params.platform)
      .eq("title", params.title)
      .eq("page_name", params.page_name || "")
      .gte("scheduled_date", `${scheduledDay}T00:00:00`)
      .lte("scheduled_date", `${scheduledDay}T23:59:59`)
      .neq("id", params.post_id)
      .limit(1);

    if (dupes && dupes.length > 0) {
      console.warn("[schedulePost] Duplicate detected on frontend:", dupes[0].id);
      return { success: false, error: "This post is already scheduled on this platform for this date." };
    }
  }

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
