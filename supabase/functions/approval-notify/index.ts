import { handleRequest } from "../_shared/requestHandler.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient, body }) => {
    const { post_id, approver_ids, mode } = body;
    const isEscalation = mode === "escalate";

    if (isEscalation) {
      const { data: overdue, error } = await serviceClient
        .from("social_approvals")
        .select("id, post_id, approver_id, escalation_count, deadline")
        .eq("status", "pending")
        .lt("deadline", new Date().toISOString());

      if (error || !overdue?.length) {
        return { escalated: 0 };
      }

      let escalated = 0;
      for (const approval of overdue) {
        const { data: post } = await serviceClient
          .from("social_posts")
          .select("title, platform")
          .eq("id", approval.post_id)
          .single();

        const title = approval.escalation_count >= 2
          ? "🚨 AUTO-APPROVED: Overdue post"
          : `⏰ Reminder: Post awaiting your approval`;

        if (approval.escalation_count >= 2) {
          await serviceClient
            .from("social_approvals")
            .update({ status: "approved", decided_at: new Date().toISOString(), feedback: "Auto-approved after escalation timeout" })
            .eq("id", approval.id);
          await serviceClient
            .from("social_posts")
            .update({ status: "scheduled" })
            .eq("id", approval.post_id);
        } else {
          await serviceClient
            .from("social_approvals")
            .update({
              escalation_count: approval.escalation_count + 1,
              notified_at: new Date().toISOString(),
              deadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            })
            .eq("id", approval.id);
        }

        try {
          await serviceClient.from("notifications").insert({
            user_id: approval.approver_id,
            type: "notification",
            title,
            description: `${post?.platform || "Social"} post "${post?.title || "Untitled"}" needs your review.`,
            priority: approval.escalation_count >= 1 ? "high" : "normal",
            link_to: "/social-media-manager",
            agent_name: "Pixel",
            status: "unread",
          });
        } catch (e) {
          console.error("Notification insert error:", e);
        }
        escalated++;
      }

      return { escalated };
    }

    // Normal notify mode
    if (!post_id || !approver_ids?.length) {
      throw new Response(JSON.stringify({ error: "post_id and approver_ids required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: post } = await serviceClient
      .from("social_posts")
      .select("title, platform")
      .eq("id", post_id)
      .single();

    let notified = 0;
    for (const approverId of approver_ids) {
      try {
        await serviceClient.from("notifications").insert({
          user_id: approverId,
          type: "notification",
          title: "📝 New post needs your approval",
          description: `${post?.platform || "Social"} post "${post?.title || "Untitled"}" is ready for your review.`,
          priority: "high",
          link_to: "/social-media-manager",
          agent_name: "Pixel",
          status: "unread",
        });
        notified++;
      } catch (e) {
        console.error("Notification insert error:", e);
      }
    }

    return { notified };
  }, { functionName: "approval-notify", requireCompany: false, wrapResult: false })
);
