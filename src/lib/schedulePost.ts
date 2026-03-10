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

  const { data, error } = await supabase.functions.invoke("schedule-post", {
    body: params,
  });

  if (error) {
    console.error("[schedulePost] Edge function invoke error:", error);
    return { success: false, error: error.message || "Failed to invoke schedule function" };
  }

  if (data?.error) {
    console.error("[schedulePost] Server returned error:", data.error, data.details);
    return { success: false, error: data.error, details: data.details };
  }

  console.log("[schedulePost] Success:", JSON.stringify(data));
  return data as SchedulePostResult;
}
