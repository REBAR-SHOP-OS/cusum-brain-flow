import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFullVizzyContext } from "../_shared/vizzyFullContext.ts";
import { callAI } from "../_shared/aiRouter.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { cacheGet, cacheSet } from "../_shared/cache.ts";

const DIGEST_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

    // Fast path: return cached digest if available (< 5 min old)
    const cacheKey = `vizzy-pre-digest:${userId}`;
    const cached = cacheGet<{ digest: string; rawContext: string; brainMemories: string | null; generated_at: string }>(cacheKey);
    if (cached) {
      console.log("[vizzy-pre-digest] Returning cached digest for", userId);
      return cached;
    }

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
      ? `\n═══ PREVIOUS AGENT AUDIT (${new Date(prevAudit.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz })}) ═══\n${prevAudit.content}`
      : "\nNo previous agent audit available.";

    // Step 2c: Load Brain Memories (vizzy_memory excluding benchmarks/timeclock)
    const { data: brainMemories } = await supabase
      .from("vizzy_memory")
      .select("category, content, created_at")
      .eq("user_id", userId)
      .not("category", "in", "(daily_benchmark,timeclock)")
      .order("created_at", { ascending: false })
      .limit(30);

    const brainBlock = (brainMemories || [])
      .map((m: any) => `[${m.category}] ${m.content}`)
      .join("\n");

    // Step 3: AI pre-digestion — produce a concise intelligence briefing
    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      agentName: "vizzy",
      messages: [
        {
          role: "system",
          content: `You are Vizzy's brain — the pre-processing layer that digests raw business data into ready-to-speak intelligence.

CRITICAL OUTPUT CONSTRAINT: Keep total output under 10,000 characters. Be DENSE, not verbose. Every sentence must carry data — no filler.

YOUR JOB: Take the raw ERP data and previous benchmarks, and produce TWO outputs:

═══ OUTPUT 0: VERIFIED FACTS (machine-readable anchor — ALWAYS output this FIRST) ═══
Output an exact-format block that the voice model will use as ground truth:
[VERIFIED FACTS]
staff_total=N
clocked_in=[Name1, Name2, ...]
clocked_out_today=[Name1, Name2, ...]
absent_today=[Name1, Name2, ...]
total_ar=$X
total_ap=$X
overdue_invoices=N
open_leads=N
hot_leads=N
calls_today_total=N
calls_today_missed=N
deliveries_scheduled=N
machines_running=N
[/VERIFIED FACTS]
Use EXACT numbers from the data. If a value is unknown, write "N/A". NEVER estimate.

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
   - Calls: count, duration, missed, direction (inbound/outbound)
   - FOR EACH PERSON WITH CALLS: List EXACT call count, duration, direction. If call notes/transcripts exist in the raw data, summarize them. If NO call notes exist, write: "No call notes available — only metadata (count/duration)". NEVER invent call content or topics discussed.
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

    // Step 4b: Deterministic timeclock snapshot from DB (not AI text parsing)
    try {
      const { data: profile2 } = await supabase
        .from("profiles")
        .select("id, company_id, full_name, is_active")
        .eq("user_id", userId)
        .maybeSingle();
      const cid = profile2?.company_id;
      if (cid) {
        // Get today's date in workspace timezone
        const todayDate = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
        // Build timezone-safe midnight: construct UTC guess then adjust by offset
        const midnightUtcGuess = Date.UTC(
          parseInt(todayDate.slice(0, 4)),
          parseInt(todayDate.slice(5, 7)) - 1,
          parseInt(todayDate.slice(8, 10)),
          0, 0, 0
        );
        // Compute the offset: how far is "tz midnight" from UTC midnight?
        const tzFormatter = new Intl.DateTimeFormat("en-US", {
          timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
        });
        const offsetParts = Object.fromEntries(
          tzFormatter.formatToParts(new Date(midnightUtcGuess))
            .filter(p => p.type !== "literal")
            .map(p => [p.type, Number(p.value)])
        );
        const zonedUtc = Date.UTC(offsetParts.year, offsetParts.month - 1, offsetParts.day, offsetParts.hour, offsetParts.minute, offsetParts.second);
        const offsetMs = zonedUtc - midnightUtcGuess;
        const todayStart = new Date(midnightUtcGuess - offsetMs);
        const todayStartIso = todayStart.toISOString();

        // Fetch ALL company profiles
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, is_active")
          .eq("company_id", cid);

        // Fetch today's time clock entries for ALL employees in the company
        const { data: todayEntries } = await supabase
          .from("time_clock_entries")
          .select("id, profile_id, clock_in, clock_out, break_minutes, notes")
          .gte("clock_in", todayStartIso)
          .order("clock_in", { ascending: true });

        // Also fetch any open shifts (no clock_out) regardless of date
        const { data: openShifts } = await supabase
          .from("time_clock_entries")
          .select("id, profile_id, clock_in, clock_out, break_minutes, notes")
          .is("clock_out", null);

        const profiles = allProfiles || [];
        const entries = todayEntries || [];
        const opens = openShifts || [];

        // Filter entries to only company profiles
        const profileIds = new Set(profiles.map((p: any) => p.id));
        const companyEntries = entries.filter((e: any) => profileIds.has(e.profile_id));
        const companyOpenShifts = opens.filter((e: any) => profileIds.has(e.profile_id));

        // Build per-employee facts
        const now = new Date();
        const tcInserts: any[] = [];
        let totalOnSite = 0;
        let totalHoursToday = 0;
        const anomalies: string[] = [];

        for (const prof of profiles) {
          const name = prof.full_name || "Unknown";
          const myEntries = companyEntries.filter((e: any) => e.profile_id === prof.id);
          const myOpenShift = companyOpenShifts.find((e: any) => e.profile_id === prof.id);

          if (myEntries.length === 0 && !myOpenShift) {
            // Not clocked in today
            tcInserts.push({
              user_id: userId,
              company_id: cid,
              category: "timeclock",
              content: `${name} — Not clocked in today`,
              metadata: { report_date: todayDate, report_timezone: tz, source: "timeclock_daily_snapshot", profile_id: prof.id },
            });
            continue;
          }

          // Calculate total hours worked today
          let totalMinutes = 0;
          let status = "clocked out";
          let clockInTime = "";
          let clockOutTime = "";

          for (const entry of myEntries) {
            const cin = new Date(entry.clock_in);
            const cout = entry.clock_out ? new Date(entry.clock_out) : now;
            const mins = (cout.getTime() - cin.getTime()) / 60000 - (entry.break_minutes || 0);
            totalMinutes += Math.max(0, mins);
            if (!clockInTime) clockInTime = cin.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: tz });
            if (entry.clock_out) clockOutTime = cout.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: tz });
          }

          // Check for currently open shift
          if (myOpenShift) {
            status = "clocked in";
            totalOnSite++;
            if (!clockInTime) {
              clockInTime = new Date(myOpenShift.clock_in).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: tz });
            }
          }

          const hours = Math.round(totalMinutes / 6) / 10; // 1 decimal
          totalHoursToday += hours;

          let content = "";
          if (status === "clocked in") {
            content = `${name} — Clocked in at ${clockInTime}, ${hours}h worked so far`;
          } else if (clockOutTime) {
            content = `${name} — Clocked in ${clockInTime}, out ${clockOutTime}, total ${hours}h`;
          } else {
            content = `${name} — ${hours}h worked today`;
          }

          tcInserts.push({
            user_id: userId,
            company_id: cid,
            category: "timeclock",
            content,
            metadata: { report_date: todayDate, report_timezone: tz, source: "timeclock_daily_snapshot", profile_id: prof.id, hours, status },
          });

          // Anomaly checks
          if (hours > 8) anomalies.push(`⚠️ ${name} overtime: ${hours}h`);
          if (clockInTime && status === "clocked in") {
            const cinDate = new Date(myOpenShift?.clock_in || myEntries[0]?.clock_in);
            const cinHour = parseInt(cinDate.toLocaleTimeString("en-US", { hour: "2-digit", hour12: false, timeZone: tz }));
            const cinMin = parseInt(cinDate.toLocaleTimeString("en-US", { minute: "2-digit", timeZone: tz }));
            if (cinHour > 7 || (cinHour === 7 && cinMin > 30)) {
              anomalies.push(`⚠️ ${name} late arrival: ${clockInTime}`);
            }
          }
        }

        // Add summary lines
        tcInserts.push({
          user_id: userId,
          company_id: cid,
          category: "timeclock",
          content: `📊 Total staff on site: ${totalOnSite} | Total team hours today: ${Math.round(totalHoursToday * 10) / 10}h`,
          metadata: { report_date: todayDate, report_timezone: tz, source: "timeclock_daily_snapshot", type: "summary" },
        });

        for (const a of anomalies) {
          tcInserts.push({
            user_id: userId,
            company_id: cid,
            category: "timeclock",
            content: a,
            metadata: { report_date: todayDate, report_timezone: tz, source: "timeclock_daily_snapshot", type: "anomaly" },
          });
        }

        // Dedupe: delete today's existing timeclock snapshot before inserting fresh
        const { data: existingToday } = await supabase
          .from("vizzy_memory")
          .select("id")
          .eq("company_id", cid)
          .eq("category", "timeclock")
          .gte("created_at", todayStartIso);

        if (existingToday && existingToday.length > 0) {
          const idsToRemove = existingToday.map((r: any) => r.id);
          await supabase.from("vizzy_memory").delete().in("id", idsToRemove);
        }

        // Insert fresh snapshot
        if (tcInserts.length > 0) {
          await supabase.from("vizzy_memory").insert(tcInserts);
        }
      }
    } catch (e) {
      console.warn("Failed to save timeclock snapshot:", e);
    }

    // Remove the benchmark JSON line from the digest (it's internal)
    const cleanDigest = fullDigest.replace(/BENCHMARK_JSON:\{[^}]+\}/, "").trim();

    const result = {
      digest: cleanDigest,
      rawContext,
      brainMemories: brainBlock || null,
      generated_at: new Date().toISOString(),
    };

    // Cache the result for fast subsequent requests
    cacheSet(cacheKey, result, DIGEST_CACHE_TTL_MS);

    return result;
  }, { functionName: "vizzy-pre-digest", requireCompany: false, wrapResult: false })
);
