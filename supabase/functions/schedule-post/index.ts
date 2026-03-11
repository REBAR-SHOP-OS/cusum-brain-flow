import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, serviceClient } = await requireAuth(req);

    const { post_id, scheduled_date, qa_status, status, platform, page_name, extra_combos, delete_original } = await req.json();

    if (!post_id || !scheduled_date) {
      return json({ error: "post_id and scheduled_date are required" }, 400);
    }

    // Server-side guard: reject past scheduling
    if (new Date(scheduled_date) <= new Date()) {
      console.warn(`[schedule-post] REJECTED — scheduled_date is in the past: ${scheduled_date}`);
      return json({ error: "Cannot schedule a post in the past" }, 400);
    }

    console.log(`[schedule-post] user=${userId} post=${post_id} date=${scheduled_date} platform=${platform} page=${page_name} delete_original=${delete_original}`);

    // Fetch full post data (needed for cloning and for unassigned detection)
    const { data: fullPost } = await serviceClient
      .from("social_posts")
      .select("*")
      .eq("id", post_id)
      .single();

    if (!fullPost) {
      return json({ error: "Post not found" }, 404);
    }

    const isUnassigned = delete_original === true || fullPost.platform === "unassigned";
    const cloned: string[] = [];

    if (isUnassigned && extra_combos && Array.isArray(extra_combos) && extra_combos.length > 0) {
      // UNASSIGNED flow: clone for ALL combos, then delete original
      const scheduledDay = scheduled_date.substring(0, 10);

      for (const combo of extra_combos) {
        // Duplicate check
        const { data: existing } = await serviceClient
          .from("social_posts")
          .select("id")
          .eq("platform", combo.platform)
          .eq("title", fullPost.title)
          .eq("page_name", combo.page)
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

      // Delete the original unassigned post
      const { error: delErr } = await serviceClient
        .from("social_posts")
        .delete()
        .eq("id", post_id);

      if (delErr) {
        console.error(`[schedule-post] Failed to delete original unassigned post:`, delErr.message);
      } else {
        console.log(`[schedule-post] Deleted original unassigned post=${post_id}`);
      }

      return json({ success: true, post: { id: post_id, status: "deleted", qa_status: "deleted", scheduled_date }, cloned_ids: cloned });
    }

    // NORMAL flow: update primary post
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
    if (extra_combos && Array.isArray(extra_combos) && extra_combos.length > 0 && fullPost) {
      const scheduledDay = scheduled_date.substring(0, 10);
      for (const combo of extra_combos) {
        const { data: existing } = await serviceClient
          .from("social_posts")
          .select("id")
          .eq("platform", combo.platform)
          .eq("title", fullPost.title)
          .eq("page_name", combo.page)
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

    return json({ success: true, post: data, cloned_ids: cloned });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(`[schedule-post] Unhandled:`, e);
    return json({ error: (e as Error).message || "Unknown error" }, 500);
  }
});
