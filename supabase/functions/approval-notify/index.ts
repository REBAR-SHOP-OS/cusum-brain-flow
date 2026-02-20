import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { post_id, approver_ids, mode } = body;

    // Mode: "notify" (new approval) or "escalate" (overdue re-notify)
    const isEscalation = mode === "escalate";

    if (isEscalation) {
      // Find all overdue pending approvals
      const { data: overdue, error } = await supabase
        .from("social_approvals")
        .select("id, post_id, approver_id, escalation_count, deadline")
        .eq("status", "pending")
        .lt("deadline", new Date().toISOString());

      if (error || !overdue?.length) {
        return new Response(JSON.stringify({ escalated: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let escalated = 0;
      for (const approval of overdue) {
        // Get post info for notification
        const { data: post } = await supabase
          .from("social_posts")
          .select("title, platform")
          .eq("id", approval.post_id)
          .single();

        const title = approval.escalation_count >= 2
          ? "🚨 AUTO-APPROVED: Overdue post"
          : `⏰ Reminder: Post awaiting your approval`;

        // If 2+ missed deadlines, auto-approve
        if (approval.escalation_count >= 2) {
          await supabase
            .from("social_approvals")
            .update({ status: "approved", decided_at: new Date().toISOString(), feedback: "Auto-approved after escalation timeout" })
            .eq("id", approval.id);

          await supabase
            .from("social_posts")
            .update({ status: "scheduled" })
            .eq("id", approval.post_id);
        } else {
          // Increment escalation and extend deadline
          await supabase
            .from("social_approvals")
            .update({
              escalation_count: approval.escalation_count + 1,
              notified_at: new Date().toISOString(),
              deadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            })
            .eq("id", approval.id);
        }

        // Send notification
        try {
          await supabase.from("notifications").insert({
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

      return new Response(JSON.stringify({ escalated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normal notify mode: notify specific approvers about a post
    if (!post_id || !approver_ids?.length) {
      return new Response(JSON.stringify({ error: "post_id and approver_ids required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: post } = await supabase
      .from("social_posts")
      .select("title, platform")
      .eq("id", post_id)
      .single();

    let notified = 0;
    for (const approverId of approver_ids) {
      try {
        await supabase.from("notifications").insert({
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

    return new Response(JSON.stringify({ notified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("approval-notify error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
