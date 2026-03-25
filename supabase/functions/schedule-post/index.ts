import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient, body } = ctx;
    const { post_id, scheduled_date, qa_status, status, platform, page_name, extra_combos, delete_original } = body;

    if (!post_id || !scheduled_date) {
      return json({ error: "post_id and scheduled_date are required" }, 400);
    }

    // Server-side guard: reject past scheduling
    if (new Date(scheduled_date) <= new Date()) {
      console.warn(`[schedule-post] REJECTED — scheduled_date is in the past: ${scheduled_date}`);
      return json({ error: "Cannot schedule a post in the past" }, 400);
    }

    console.log(`[schedule-post] user=${userId} post=${post_id} date=${scheduled_date} platform=${platform} page=${page_name} delete_original=${delete_original}`);

    // Fetch full post data
    const { data: fullPost } = await serviceClient
      .from("social_posts")
      .select("*")
      .eq("id", post_id)
      .single();

    if (!fullPost) {
      return json({ error: "Post not found" }, 404);
    }

    // HARD GATE: declined posts can NEVER be scheduled
    if (fullPost.status === "declined") {
      console.warn(`[schedule-post] BLOCKED — post ${post_id} is declined (by ${fullPost.declined_by || 'unknown'})`);
      return json({ error: "This post was declined and cannot be scheduled." }, 403);
    }

    const isUnassigned = delete_original === true || fullPost.platform === "unassigned";
    const cloned: string[] = [];

    const sanitizedCombos = (extra_combos && Array.isArray(extra_combos))
      ? extra_combos.filter((c: any) => c.platform && c.platform !== "unassigned")
      : [];

    if (isUnassigned && sanitizedCombos.length > 0) {
      const scheduledDay = scheduled_date.substring(0, 10);

      for (const combo of sanitizedCombos) {
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
          console.log(`[schedule-post] Updating existing post ${existing[0].id} for ${combo.platform}/${combo.page}`);
          await serviceClient
            .from("social_posts")
            .update({
              scheduled_date,
              status: "scheduled",
              qa_status: "scheduled",
              content: fullPost.content,
              image_url: fullPost.image_url,
              hashtags: fullPost.hashtags,
            })
            .eq("id", existing[0].id);
          cloned.push(existing[0].id);
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

      const { error: delErr } = await serviceClient
        .from("social_posts")
        .delete()
        .eq("id", post_id);

      if (delErr) {
        console.error(`[schedule-post] Failed to delete original unassigned post:`, delErr.message);
      } else {
        console.log(`[schedule-post] Deleted original unassigned post=${post_id}`);
      }

      if (fullPost.title) {
        const { data: siblings, error: sibErr } = await serviceClient
          .from("social_posts")
          .delete()
          .eq("platform", "unassigned")
          .eq("title", fullPost.title)
          .eq("user_id", fullPost.user_id)
          .in("status", ["draft", "pending_approval"])
          .gte("scheduled_date", `${scheduledDay}T00:00:00`)
          .lte("scheduled_date", `${scheduledDay}T23:59:59`)
          .select("id");

        if (sibErr) {
          console.error(`[schedule-post] Sibling cleanup error:`, sibErr.message);
        } else if (siblings && siblings.length > 0) {
          console.log(`[schedule-post] Cleaned up ${siblings.length} sibling unassigned draft posts`);
        }
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

    if (sanitizedCombos.length > 0 && fullPost) {
      const scheduledDay = scheduled_date.substring(0, 10);
      for (const combo of sanitizedCombos) {
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
          console.log(`[schedule-post] Updating existing post ${existing[0].id} for ${combo.platform}/${combo.page}`);
          await serviceClient
            .from("social_posts")
            .update({
              scheduled_date,
              status: "scheduled",
              qa_status: "scheduled",
              content: fullPost.content,
              image_url: fullPost.image_url,
              hashtags: fullPost.hashtags,
            })
            .eq("id", existing[0].id);
          cloned.push(existing[0].id);
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
  }, { functionName: "schedule-post", requireCompany: false, wrapResult: false })
);
