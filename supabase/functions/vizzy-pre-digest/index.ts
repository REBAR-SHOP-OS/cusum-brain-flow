import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFullVizzyContext } from "../_shared/vizzyFullContext.ts";
import { callAI } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Vizzy Pre-Digest: Before a voice session starts, this function:
 * 1. Loads raw ERP context (all data sources)
 * 2. Loads previous benchmarks from vizzy_memory (category = 'benchmark')
 * 3. Runs AI to digest everything into a concise intelligence briefing with comparisons
 * 4. Saves today's benchmarks back to vizzy_memory for next session
 * 5. Returns the pre-digested context for the voice engine
 *
 * This means Vizzy starts every conversation already knowing everything —
 * like a human who studied the business before walking into the room.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anonClient.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 5 per 10 minutes (heavier than daily-brief)
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _user_id: user.id,
      _function_name: "vizzy-pre-digest",
      _max_requests: 5,
      _window_seconds: 600,
    });
    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: "Rate limited. Try again in a few minutes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Load raw ERP context
    const rawContext = await buildFullVizzyContext(supabase, user.id, {
      includeFinancials: true,
    });

    // Step 2: Load previous benchmarks from vizzy_memory
    const { data: prevBenchmarks } = await supabase
      .from("vizzy_memory")
      .select("content, metadata, created_at")
      .eq("user_id", user.id)
      .eq("category", "daily_benchmark")
      .order("created_at", { ascending: false })
      .limit(7); // Last 7 sessions for trend analysis

    const benchmarkHistory = (prevBenchmarks || []).map((b: any) => {
      const date = new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `[${date}] ${b.content}`;
    }).join("\n");

    // Step 3: AI pre-digestion — produce a concise intelligence briefing
    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      agentName: "vizzy",
      messages: [
        {
          role: "system",
          content: `You are Vizzy's brain — the pre-processing layer that digests raw business data into ready-to-speak intelligence.

YOUR JOB: Take the raw ERP data and previous benchmarks, and produce TWO outputs:

═══ OUTPUT 1: DIGESTED INTELLIGENCE (for the voice session) ═══
Convert all the raw data into a pre-analyzed, ready-to-speak format. Vizzy should be able to answer ANY question by reading this — no searching needed.

Structure it as:
1. [FACTS] block — copy verbatim from raw data
2. MOTIVATIONAL OPENER — a warm, genuine good morning message with something uplifting (a quote, encouragement based on yesterday's wins, or a personal observation). Make it feel human, not corporate.
3. TODAY'S PULSE — 3-4 sentence executive summary of the day's state
4. NOTABLE CHANGES — what's different from previous benchmarks (up/down trends, new patterns)
5. EMAIL TRIAGE — categorize inbox emails as:
   - 🔴 URGENT (needs reply today)
   - 🟡 NEEDS REPLY (can wait but should respond)
   - 🟢 FYI (no action needed)
   Include sender, subject, and one-line summary for each.
6. PER-PERSON INTELLIGENCE — for EACH employee with ANY activity today:
   - Name, hours clocked, active time, utilization %
   - Calls: count, duration, missed, call note summaries (what they actually discussed)
   - Emails: sent/received count
   - Work orders, AI sessions, notable actions
   - YOUR ASSESSMENT: one sentence rating their day (productive/light/concerning)
   - COACHING NOTE: if applicable, one specific improvement suggestion
7. FINANCIAL HEALTH — key numbers + any concerning trends vs benchmarks
8. PRODUCTION STATUS — bottlenecks, progress, machine utilization
9. SALES PIPELINE — hot leads, stalled opportunities, call quality observations
10. RED FLAGS — anything that needs CEO attention, ranked by severity
11. OPPORTUNITIES — things going well that could be leveraged
12. MORNING SCHEDULE PROPOSAL — a time-blocked daily plan for the CEO based on priorities:
   - 8:00 AM — Review [specific item]
   - 9:00 AM — Follow up on [overdue invoice / hot lead]
   - etc.
   Base this on: overdue invoices, hot leads needing action, deliveries to track, production issues, emails requiring replies.

CRITICAL RULES:
- Preserve ALL specific numbers, names, amounts — Vizzy needs these for voice answers
- Pre-analyze patterns so Vizzy doesn't have to think — just speak
- Compare against previous benchmarks when available: "AR is up 12% from last week"
- Be opinionated — this is Vizzy's internal analysis, not a neutral report

═══ OUTPUT 2: TODAY'S BENCHMARK (JSON on last line) ═══
On the very last line, output a JSON object with today's key metrics for future comparison:
BENCHMARK_JSON:{"ar":NUMBER,"ap":NUMBER,"open_leads":NUMBER,"staff_clocked":NUMBER,"total_calls":NUMBER,"missed_calls":NUMBER,"emails_sent":NUMBER,"emails_received":NUMBER,"active_cut_plans":NUMBER,"deliveries_scheduled":NUMBER}

${benchmarkHistory ? `\n═══ PREVIOUS BENCHMARKS ═══\n${benchmarkHistory}` : "No previous benchmarks — this is the first session."}`,
        },
        {
          role: "user",
          content: rawContext,
        },
      ],
    });

    const fullDigest = result.content || "";

    // Step 4: Extract benchmark JSON and save to vizzy_memory
    const benchmarkMatch = fullDigest.match(/BENCHMARK_JSON:(\{[^}]+\})/);
    if (benchmarkMatch) {
      try {
        const benchmarkData = JSON.parse(benchmarkMatch[1]);
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        // Save today's benchmark
        await supabase.from("vizzy_memory").insert({
          user_id: user.id,
          category: "daily_benchmark",
          content: JSON.stringify(benchmarkData),
          metadata: { date: new Date().toISOString().split("T")[0], ...benchmarkData },
          company_id: profile?.company_id || null,
        });

        // Clean up old benchmarks (keep last 30)
        const { data: oldBenchmarks } = await supabase
          .from("vizzy_memory")
          .select("id, created_at")
          .eq("user_id", user.id)
          .eq("category", "daily_benchmark")
          .order("created_at", { ascending: false });

        if (oldBenchmarks && oldBenchmarks.length > 30) {
          const idsToDelete = oldBenchmarks.slice(30).map((b: any) => b.id);
          await supabase.from("vizzy_memory").delete().in("id", idsToDelete);
        }
      } catch (e) {
        console.warn("Failed to save benchmark:", e);
      }
    }

    // Remove the benchmark JSON line from the digest (it's internal)
    const cleanDigest = fullDigest.replace(/BENCHMARK_JSON:\{[^}]+\}/, "").trim();

    return new Response(
      JSON.stringify({
        digest: cleanDigest,
        rawContext,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("vizzy-pre-digest error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
