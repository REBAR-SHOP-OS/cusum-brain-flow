import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { date } = await req.json(); // ISO date string e.g. "2026-02-07"

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const targetDate = date || new Date().toISOString().split("T")[0];
    const dayStart = `${targetDate}T00:00:00.000Z`;
    const dayEnd = `${targetDate}T23:59:59.999Z`;

    // ── Fetch real data in parallel ──────────────────────────────────
    const [
      emailsRes,
      tasksRes,
      leadsRes,
      ordersRes,
      workOrdersRes,
      deliveriesRes,
      teamMsgsRes,
      meetingsRes,
      rcCallsRes,
    ] = await Promise.all([
      supabase
        .from("communications")
        .select("from_address, to_address, subject, body_preview, received_at, status, source")
        .eq("source", "gmail")
        .gte("received_at", dayStart)
        .lte("received_at", dayEnd)
        .order("received_at", { ascending: false })
        .limit(50),
      supabase
        .from("tasks")
        .select("title, description, status, priority, due_date, agent_type")
        .or(`created_at.gte.${dayStart},due_date.eq.${targetDate}`)
        .limit(30),
      supabase
        .from("leads")
        .select("title, stage, expected_value, priority, source, expected_close_date")
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("orders")
        .select("order_number, status, total_amount, required_date, notes")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .limit(20),
      supabase
        .from("work_orders")
        .select("work_order_number, status, scheduled_start, scheduled_end, workstation, notes")
        .or(`scheduled_start.gte.${dayStart},actual_start.gte.${dayStart}`)
        .limit(20),
      supabase
        .from("deliveries")
        .select("delivery_number, status, scheduled_date, driver_name, notes")
        .eq("scheduled_date", targetDate)
        .limit(20),
      supabase
        .from("team_messages")
        .select("original_text, original_language, sender_profile_id, created_at, channel_id")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .order("created_at", { ascending: false })
        .limit(50),
      // Team meetings with AI summaries
      supabase
        .from("team_meetings")
        .select("title, meeting_type, started_at, ended_at, ai_summary, participants, duration_seconds, status")
        .gte("started_at", dayStart)
        .lte("started_at", dayEnd)
        .order("started_at", { ascending: false })
        .limit(20),
      // RingCentral calls from communications
      supabase
        .from("communications")
        .select("from_address, to_address, subject, body_preview, received_at, status, source, metadata")
        .eq("source", "ringcentral")
        .gte("received_at", dayStart)
        .lte("received_at", dayEnd)
        .order("received_at", { ascending: false })
        .limit(50),
    ]);

    const emails = emailsRes.data || [];
    const tasks = tasksRes.data || [];
    const leads = leadsRes.data || [];
    const orders = ordersRes.data || [];
    const workOrders = workOrdersRes.data || [];
    const deliveries = deliveriesRes.data || [];
    const teamMessages = teamMsgsRes.data || [];
    const meetings = meetingsRes.data || [];
    const rcCalls = rcCallsRes.data || [];

    // ── Build context for AI ─────────────────────────────────────────
    const dataContext = `
=== DAILY DATA FOR ${targetDate} ===

--- EMAILS (${emails.length} received today) ---
${emails.length > 0
  ? emails.map((e, i) => `${i + 1}. From: ${e.from_address} | Subject: ${e.subject || "(no subject)"} | Preview: ${(e.body_preview || "").slice(0, 150)}`).join("\n")
  : "No emails received today."
}

--- TASKS (${tasks.length} active/due) ---
${tasks.length > 0
  ? tasks.map((t, i) => `${i + 1}. [${t.priority || "normal"}] ${t.title} — Status: ${t.status || "pending"}${t.due_date ? ` | Due: ${t.due_date}` : ""}`).join("\n")
  : "No tasks due today."
}

--- SALES PIPELINE (${leads.length} active leads) ---
${leads.length > 0
  ? leads.map((l, i) => `${i + 1}. ${l.title} — Stage: ${l.stage} | Value: $${l.expected_value || 0} | Priority: ${l.priority || "normal"}`).join("\n")
  : "No active leads."
}

--- ORDERS (${orders.length} new today) ---
${orders.length > 0
  ? orders.map((o, i) => `${i + 1}. #${o.order_number} — Status: ${o.status} | Amount: $${o.total_amount || 0}`).join("\n")
  : "No new orders today."
}

--- SHOP FLOOR (${workOrders.length} work orders) ---
${workOrders.length > 0
  ? workOrders.map((w, i) => `${i + 1}. WO#${w.work_order_number} — Status: ${w.status} | Station: ${w.workstation || "unassigned"}`).join("\n")
  : "No work orders scheduled."
}

--- DELIVERIES (${deliveries.length} scheduled) ---
${deliveries.length > 0
  ? deliveries.map((d, i) => `${i + 1}. ${d.delivery_number} — Status: ${d.status} | Driver: ${d.driver_name || "unassigned"}`).join("\n")
  : "No deliveries scheduled."
}

--- TEAM HUB (${teamMessages.length} messages today) ---
${teamMessages.length > 0
  ? teamMessages.map((m: any, i: number) => `${i + 1}. [${m.original_language}] ${(m.original_text || "").slice(0, 200)}`).join("\n")
  : "No team messages today."
}

--- TEAM MEETINGS (${meetings.length} today) ---
${meetings.length > 0
  ? meetings.map((m: any, i: number) => {
      const dur = m.duration_seconds ? `${Math.round(m.duration_seconds / 60)}min` : "ongoing";
      const participants = (m.participants || []).join(", ") || "N/A";
      return `${i + 1}. ${m.title} (${m.meeting_type}) — ${dur} | Participants: ${participants}${m.ai_summary ? `\n   Summary: ${m.ai_summary}` : ""}`;
    }).join("\n")
  : "No team meetings today."
}

--- RINGCENTRAL CALLS & SMS (${rcCalls.length} today) ---
${rcCalls.length > 0
  ? rcCalls.map((c: any, i: number) => {
      const meta = c.metadata || {};
      const type = meta.type || "call";
      const duration = meta.duration ? `${Math.floor(meta.duration / 60)}m ${meta.duration % 60}s` : "";
      const result = meta.result || "";
      return `${i + 1}. [${type.toUpperCase()}] ${c.subject || ""} | From: ${c.from_address} → To: ${c.to_address}${duration ? ` | Duration: ${duration}` : ""}${result ? ` | Result: ${result}` : ""}`;
    }).join("\n")
  : "No RingCentral calls/SMS today."
}
`;

    // ── Call Lovable AI ───────────────────────────────────────────────
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a smart Daily Digest AI assistant for a steel/rebar manufacturing company called Rebar.shop. 
Generate a structured daily summary digest in JSON format based on real business data provided.

You MUST return valid JSON with this exact structure (no markdown, no code fences):
{
  "greeting": "A warm personalized greeting mentioning the date",
  "affirmation": "A motivational business affirmation relevant to the day's activities",
  "keyTakeaways": ["Array of 3-5 key business takeaways with emoji, each a concise actionable insight"],
  "emailCategories": [
    {
      "category": "Category name with emoji (e.g. 'Sales & Pipeline 📞')",
      "emails": [
        {
          "subject": "Email subject or topic",
          "summary": "Brief summary of issue/content",
          "action": "Recommended action to take"
        }
      ]
    }
  ],
  "meetingSummaries": [
    {
      "title": "Meeting title with emoji",
      "type": "video/audio/screen_share",
      "duration": "Duration in minutes",
      "summary": "AI-generated meeting summary",
      "actionItems": ["Action items from meeting"]
    }
  ],
  "phoneCalls": [
    {
      "contact": "Caller/receiver name or number",
      "direction": "Inbound/Outbound",
      "duration": "Call duration",
      "summary": "Brief summary",
      "action": "Follow-up action needed"
    }
  ],
  "calendarEvents": [
    {
      "time": "Suggested time slot",
      "title": "Event/task title with emoji",
      "purpose": "What to do and why"
    }
  ],
  "tipOfTheDay": {
    "title": "Actionable tip title with emoji",
    "steps": ["Step 1", "Step 2", "Step 3"],
    "closing": "Motivational closing with emoji"
  },
  "randomFact": "An interesting random fact"
}

Rules:
- Group emails by business category (IT/Security, Sales/Operations, Finance/Admin, etc.)
- Prioritize urgent items first
- Include specific numbers, names, and amounts from the data
- Include meeting summaries with key decisions and action items
- Summarize all RingCentral phone calls and SMS with recommended follow-ups
- If there's little data, still provide useful suggestions and planning tips
- Keep takeaways actionable and concise
- Suggest calendar blocks for follow-ups based on the data`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Generate the daily digest for ${targetDate}.\n\n${dataContext}`,
            },
          ],
          temperature: 0.7,
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted, please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse the JSON response (strip markdown fences if present)
    let digest;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      digest = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      throw new Error("Failed to parse AI digest response");
    }

    return new Response(
      JSON.stringify({
        digest,
        stats: {
          emails: emails.length,
          tasks: tasks.length,
          leads: leads.length,
          orders: orders.length,
          workOrders: workOrders.length,
          deliveries: deliveries.length,
          teamMessages: teamMessages.length,
          meetings: meetings.length,
          phoneCalls: rcCalls.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Daily summary error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
