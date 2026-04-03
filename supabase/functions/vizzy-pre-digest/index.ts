import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFullVizzyContext } from "../_shared/vizzyFullContext.ts";
import { callAI } from "../_shared/aiRouter.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

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
Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: supabase } = ctx;

    // Rate limit: 5 per 10 minutes
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _user_id: userId,
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
    const rawContext = await buildFullVizzyContext(supabase, userId, {
      includeFinancials: true,
    });

    // Resolve workspace timezone for consistent date formatting
    const { getWorkspaceTimezone } = await import("../_shared/getWorkspaceTimezone.ts");
    const tz = await getWorkspaceTimezone(supabase);

    // Step 2: Load previous benchmarks from vizzy_memory
    const { data: prevBenchmarks } = await supabase
      .from("vizzy_memory")
      .select("content, metadata, created_at")
      .eq("user_id", userId)
      .eq("category", "daily_benchmark")
      .order("created_at", { ascending: false })
      .limit(7); // Last 7 sessions for trend analysis

    const benchmarkHistory = (prevBenchmarks || []).map((b: any) => {
      const date = new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz });
      return `[${date}] ${b.content}`;
    }).join("\n");

    // Step 2b: Load latest agent audit from vizzy_memory
    const { data: prevAudit } = await supabase
      .from("vizzy_memory")
      .select("content, created_at")
      .eq("user_id", userId)
      .eq("category", "agent_audit")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const agentAuditContext = prevAudit
      ? `\n═══ PREVIOUS AGENT AUDIT (${new Date(prevAudit.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}) ═══\n${prevAudit.content}`
      : "\nNo previous agent audit available.";

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

CRITICAL TIME RULES:
- Clearly separate TODAY's data from HISTORICAL data
- For each employee, check if they have ANY activity TODAY (clock-in, calls, emails, page views, AI sessions)
- If an employee has ZERO activity today, list them in the ABSENT EMPLOYEES section
- NEVER mix previous days' call notes or activity with today's report

Structure it as:

═══ TODAY ONLY (do NOT mix with previous days) ═══

0. ABSENT EMPLOYEES — List every employee with ZERO activity today:
   Format: "❌ ABSENT: [Name] — No clock-in, no calls, no emails, no system activity today. DO NOT report any activity for this person today."
   This section is CRITICAL for voice mode to avoid fabricating activity for absent staff.

1. [FACTS] block — copy verbatim from raw data (TODAY ONLY)
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
13. AUTO-DELEGATION PLAN — For EACH red flag found in the data, output a pre-built task:
    - Task title (actionable, specific)
    - Which employee should handle it (by name)
    - Priority (high/medium/low)
    - Category (follow-up, production, accounting, sales, support)
    Format: "DELEGATE: [title] → [employee_name] (priority: [high/medium/low], category: [cat])"
    Check the OPEN TASKS section first — do NOT create duplicates of tasks that already exist.
14. CEO-ONLY DECISIONS — Items that genuinely require the CEO's human judgment, ranked by business impact:
    - Financial decisions (credit terms, write-offs, large payments)
    - Personnel issues requiring CEO intervention
    - Strategic decisions, pricing changes
    - Client escalation situations
    Format: "CEO-DECIDE: [description] — Impact: [high/medium] — Why only CEO: [reason]"
15. SELF-IMPROVEMENT NOTES — Operational patterns you noticed that could improve the business:
    - Employee behavior patterns (e.g., "Neel consistently misses follow-up emails after calls")
    - Process inefficiencies (e.g., "Invoices over 30 days are not being followed up systematically")
    - System gaps (e.g., "No one is checking production queue daily")
    Format: "IMPROVE: [observation] — Suggestion: [actionable improvement]"
16. AGENT INTELLIGENCE AUDIT — Review ALL AI agents (EXCEPT social/Pixel) based on the PREVIOUS AGENT AUDIT data if available:
    - For each agent: score (1-10), key strength, key weakness
    - Sales agent gets special attention: coaching notes for Radin
    - If any agent needs a prompt fix, include a ready-to-paste LOVABLE COMMAND block:
      LOVABLE COMMAND:
      Fix the [Agent] prompt in \`supabase/functions/_shared/agents/[file].ts\`.
      PROBLEM: [issue]
      FIX: [exact change]
      FILE: supabase/functions/_shared/agents/[file].ts
      DO NOT TOUCH: All other files
    - Summary line: "Agent Health: X agents audited, Y need attention, Z Lovable patches ready"

═══ HISTORICAL CONTEXT (previous days, for reference only — NOT today) ═══
17. PREVIOUS DAYS CALL NOTES — Only include call notes from days BEFORE today, clearly dated
18. TREND DATA — Benchmark comparisons from previous sessions

CRITICAL RULES:
- Preserve ALL specific numbers, names, amounts — Vizzy needs these for voice answers
- Pre-analyze patterns so Vizzy doesn't have to think — just speak
- Compare against previous benchmarks when available: "AR is up 12% from last week"
- Be opinionated — this is Vizzy's internal analysis, not a neutral report
- ABSENT EMPLOYEES MUST be listed even if the list is short — voice mode depends on this to avoid hallucinating activity

${benchmarkHistory ? `\n═══ PREVIOUS BENCHMARKS ═══\n${benchmarkHistory}` : "No previous benchmarks — this is the first session."}
${agentAuditContext}`,
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
          .eq("user_id", userId)
          .maybeSingle();

        // Save today's benchmark
        await supabase.from("vizzy_memory").insert({
          user_id: userId,
          category: "daily_benchmark",
          content: JSON.stringify(benchmarkData),
          metadata: { date: new Date().toISOString().split("T")[0], ...benchmarkData },
          company_id: profile?.company_id || null,
        });

        // Clean up old benchmarks (keep last 30)
        const { data: oldBenchmarks } = await supabase
          .from("vizzy_memory")
          .select("id, created_at")
          .eq("user_id", userId)
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

    return {
      digest: cleanDigest,
      rawContext,
      generated_at: new Date().toISOString(),
    };
  }, { functionName: "vizzy-pre-digest", requireCompany: false, wrapResult: false })
);
