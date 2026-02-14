import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFullVizzyContext } from "../_shared/vizzyFullContext.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anonClient.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 1 per 10 minutes
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _user_id: user.id,
      _function_name: "vizzy-daily-brief",
      _max_requests: 1,
      _window_seconds: 600,
    });
    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: "Rate limited. Try again in a few minutes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const context = await buildFullVizzyContext(supabase, user.id);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are JARVIS, the CEO's AI assistant. Generate a concise daily briefing.
Use the live data below. Return exactly 5 bullet points covering:
1. Most urgent item requiring attention
2. Financial health (AR/AP, overdue items)
3. Production status (bottlenecks, completions)
4. Hot leads or CRM updates
5. Team presence / notable events

Format: Start with "${greeting}, boss." then 5 bullet points using markdown. Keep each bullet to 1-2 sentences max. Be direct and actionable. If there are saved memories/reminders, mention the most relevant one.`,
          },
          {
            role: "user",
            content: context,
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("AI error:", resp.status, errText);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await resp.json();
    const briefing = aiData.choices?.[0]?.message?.content || "No briefing available.";

    return new Response(
      JSON.stringify({ briefing, generated_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("vizzy-daily-brief error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
