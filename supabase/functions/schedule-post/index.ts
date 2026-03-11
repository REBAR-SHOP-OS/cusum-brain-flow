import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, serviceClient } = await requireAuth(req);

    const { post_id, scheduled_date, qa_status, status, platform, page_name, extra_combos } = await req.json();

    if (!post_id || !scheduled_date) {
      return json({ error: "post_id and scheduled_date are required" }, 400);
    }

    console.log(`[schedule-post] user=${userId} post=${post_id} date=${scheduled_date} platform=${platform} page=${page_name}`);

    // Update the primary post using service role (bypasses RLS)
    const { data, error } = await serviceClient
      .from("social_posts")
      .update({
        status: status || "scheduled",
        qa_status: qa_status || "scheduled",
        scheduled_date,
        ...(platform ? { platform } : {}),
        ...(page_name ? { page_name } : {}),
      })
      .eq("id", post_id)
      .select("id, status, qa_status, scheduled_date")
      .single();

    if (error) {
      console.error(`[schedule-post] UPDATE failed:`, error.message, error.details, error.hint);
      return json({ error: error.message, details: error.details, hint: error.hint }, 500);
    }

    if (!data) {
      console.error(`[schedule-post] UPDATE returned null — post not found or blocked`);
      return json({ error: "Post not found or update blocked" }, 404);
    }

    console.log(`[schedule-post] PRIMARY updated:`, JSON.stringify(data));

    // Handle extra platform×page combos (clone post for each)
    const cloned: string[] = [];
    if (extra_combos && Array.isArray(extra_combos) && extra_combos.length > 0) {
      // Fetch full post data for cloning
      const { data: fullPost } = await serviceClient
        .from("social_posts")
        .select("*")
        .eq("id", post_id)
        .single();

      if (fullPost) {
        const scheduledDay = scheduled_date.substring(0, 10);
        for (const combo of extra_combos) {
          // Server-side duplicate check before cloning
          const { data: existing } = await serviceClient
            .from("social_posts")
            .select("id")
            .eq("platform", combo.platform)
            .eq("title", fullPost.title)
            .gte("scheduled_date", `${scheduledDay}T00:00:00`)
            .lte("scheduled_date", `${scheduledDay}T23:59:59`)
            .limit(1);

          if (existing && existing.length > 0) {
            console.warn(`[schedule-post] Duplicate skipped for ${combo.platform}/${combo.page}: existing=${existing[0].id}`);
            continue;
          }

          const { data: clone, error: cloneErr } = await serviceClient
            .from("social_posts")
            .insert({
              user_id: fullPost.user_id,
              platform: combo.platform,
              status: "scheduled",
              qa_status: "scheduled",
              title: fullPost.title,
              content: fullPost.content,
              image_url: fullPost.image_url,
              scheduled_date,
              hashtags: fullPost.hashtags,
              page_name: combo.page,
              content_type: fullPost.content_type,
            })
            .select("id")
            .single();

          if (cloneErr) {
            console.error(`[schedule-post] Clone failed for ${combo.platform}/${combo.page}:`, cloneErr.message);
          } else if (clone) {
            cloned.push(clone.id);
          }
        }
      }
    }

    return json({ success: true, post: data, cloned_ids: cloned });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(`[schedule-post] Unhandled:`, e);
    return json({ error: (e as Error).message || "Unknown error" }, 500);
  }
});
