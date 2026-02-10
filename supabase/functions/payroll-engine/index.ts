import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DailySnapshot {
  profile_id: string;
  work_date: string;
  employee_type: string;
  raw_clock_in: string | null;
  raw_clock_out: string | null;
  lunch_deducted_minutes: number;
  paid_break_minutes: number;
  expected_minutes: number;
  paid_minutes: number;
  overtime_minutes: number;
  exceptions: any[];
  ai_notes: string | null;
  status: string;
  company_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id, week_start } = await req.json();
    if (!company_id || !week_start) {
      return new Response(JSON.stringify({ error: "company_id and week_start required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Calculate week range (Mon-Sun)
    const wsDate = new Date(week_start + "T00:00:00Z");
    const weDate = new Date(wsDate);
    weDate.setUTCDate(weDate.getUTCDate() + 6);
    const weekEnd = weDate.toISOString().split("T")[0];

    // Fetch profiles for this company
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, department, employee_type, company_id")
      .eq("company_id", company_id)
      .eq("is_active", true);
    if (pErr) throw pErr;

    // Fetch time clock entries for the week
    const weekStartTs = week_start + "T00:00:00Z";
    const weekEndTs = weekEnd + "T23:59:59Z";
    const { data: entries, error: eErr } = await supabase
      .from("time_clock_entries")
      .select("*")
      .in("profile_id", profiles!.map((p: any) => p.id))
      .gte("clock_in", weekStartTs)
      .lte("clock_in", weekEndTs)
      .order("clock_in", { ascending: true });
    if (eErr) throw eErr;

    // Group entries by profile
    const entriesByProfile: Record<string, any[]> = {};
    for (const e of entries || []) {
      if (!entriesByProfile[e.profile_id]) entriesByProfile[e.profile_id] = [];
      entriesByProfile[e.profile_id].push(e);
    }

    // Generate weekdays (Mon-Fri)
    const weekdays: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(wsDate);
      d.setUTCDate(d.getUTCDate() + i);
      weekdays.push(d.toISOString().split("T")[0]);
    }

    const allSnapshots: DailySnapshot[] = [];
    const aiPrompts: { profileName: string; profileId: string; summaryText: string }[] = [];

    for (const profile of profiles || []) {
      // Determine employee type
      const empType = profile.employee_type ||
        (["office", "admin", "management"].some((d) => (profile.department || "").toLowerCase().includes(d))
          ? "office"
          : "workshop");

      const profileEntries = entriesByProfile[profile.id] || [];
      let weekTotalPaidMin = 0;
      const profileSnapshots: DailySnapshot[] = [];
      let exceptionCount = 0;
      const dailySummaries: string[] = [];

      for (const day of weekdays) {
        const dayEntries = profileEntries.filter((e: any) => e.clock_in.startsWith(day));
        const exceptions: any[] = [];

        let rawIn: string | null = null;
        let rawOut: string | null = null;
        let paidMinutes = 0;
        let lunchDeducted = 30;
        let paidBreak = empType === "workshop" ? 30 : 0;

        if (dayEntries.length === 0) {
          // Missing punch entirely
          exceptions.push({ type: "missing_punch", message: "No clock entry for this workday", confidence: 95 });
        } else {
          const entry = dayEntries[0]; // Primary entry
          rawIn = entry.clock_in;
          rawOut = entry.clock_out;

          if (!rawOut) {
            exceptions.push({ type: "missing_punch", message: "Clocked in but no clock-out recorded", confidence: 90 });
            paidMinutes = 0;
          } else {
            const grossMin = Math.round((new Date(rawOut).getTime() - new Date(rawIn!).getTime()) / 60000);
            paidMinutes = Math.max(0, grossMin - lunchDeducted);

            // Check for lunch overlap (shift < 5h = no lunch deduction needed)
            if (grossMin < 300) {
              lunchDeducted = 0;
              paidMinutes = grossMin;
            }

            // Check hours mismatch
            if (paidMinutes !== 510 && rawOut) {
              const diff = paidMinutes - 510;
              if (Math.abs(diff) > 15) {
                exceptions.push({
                  type: "hours_mismatch",
                  message: `Paid ${(paidMinutes / 60).toFixed(1)}h vs expected 8.5h (${diff > 0 ? "+" : ""}${(diff / 60).toFixed(1)}h)`,
                  confidence: 85,
                });
              }
            }

            // Early/late check (before 5:30 AM or after 8 PM)
            const clockInHour = new Date(rawIn!).getUTCHours();
            if (clockInHour < 5 || clockInHour > 10) {
              exceptions.push({ type: "early_late", message: `Unusual clock-in time: ${new Date(rawIn!).toLocaleTimeString()}`, confidence: 70 });
            }
          }
        }

        exceptionCount += exceptions.length;
        const snap: DailySnapshot = {
          profile_id: profile.id,
          work_date: day,
          employee_type: empType,
          raw_clock_in: rawIn,
          raw_clock_out: rawOut,
          lunch_deducted_minutes: lunchDeducted,
          paid_break_minutes: paidBreak,
          expected_minutes: 510,
          paid_minutes: paidMinutes,
          overtime_minutes: 0,
          exceptions,
          ai_notes: null,
          status: exceptions.length > 0 ? "auto" : "auto",
          company_id,
        };
        profileSnapshots.push(snap);
        weekTotalPaidMin += paidMinutes;

        if (rawIn) {
          dailySummaries.push(`${day}: ${(paidMinutes / 60).toFixed(1)}h${exceptions.length > 0 ? ` (${exceptions.length} issues)` : ""}`);
        } else {
          dailySummaries.push(`${day}: absent/missing`);
        }
      }

      // Weekly overtime calc (>44h = 2640min)
      const overtimeMin = Math.max(0, weekTotalPaidMin - 2640);
      const regularMin = weekTotalPaidMin - overtimeMin;

      // Distribute overtime to last days
      if (overtimeMin > 0) {
        let remaining = overtimeMin;
        for (let i = profileSnapshots.length - 1; i >= 0 && remaining > 0; i--) {
          const snap = profileSnapshots[i];
          const ot = Math.min(snap.paid_minutes, remaining);
          snap.overtime_minutes = ot;
          remaining -= ot;
          if (ot > 0) {
            snap.exceptions.push({ type: "overtime_threshold", message: `${(ot / 60).toFixed(1)}h overtime on this day`, confidence: 100 });
          }
        }
      }

      allSnapshots.push(...profileSnapshots);
      aiPrompts.push({
        profileName: profile.full_name,
        profileId: profile.id,
        summaryText: `Employee: ${profile.full_name} (${empType})\nWeek total: ${(weekTotalPaidMin / 60).toFixed(1)}h\nOvertime: ${(overtimeMin / 60).toFixed(1)}h\nExceptions: ${exceptionCount}\n${dailySummaries.join("\n")}`,
      });
    }

    // Generate AI notes via Lovable AI
    let aiNotesMap: Record<string, string> = {};
    try {
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableKey && aiPrompts.length > 0) {
        const batchPrompt = aiPrompts
          .map((p) => `--- ${p.profileName} (${p.profileId}) ---\n${p.summaryText}`)
          .join("\n\n");

        const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "You are a payroll auditor. For each employee below, write 1-2 SHORT actionable audit notes. Focus on exceptions and anomalies. If clean, say 'Clean week — no issues.' Return format: one line per employee: PROFILE_ID|note text",
              },
              { role: "user", content: batchPrompt },
            ],
            temperature: 0.3,
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          for (const line of content.split("\n")) {
            const pipeIdx = line.indexOf("|");
            if (pipeIdx > 0) {
              const pid = line.substring(0, pipeIdx).trim();
              const note = line.substring(pipeIdx + 1).trim();
              aiNotesMap[pid] = note;
            }
          }
        }
      }
    } catch (aiErr) {
      console.error("AI notes generation failed (non-fatal):", aiErr);
    }

    // Apply AI notes to snapshots
    for (const snap of allSnapshots) {
      snap.ai_notes = aiNotesMap[snap.profile_id] || null;
    }

    // Upsert daily snapshots
    const { error: upsertErr } = await supabase
      .from("payroll_daily_snapshot")
      .upsert(allSnapshots, { onConflict: "profile_id,work_date" });
    if (upsertErr) throw upsertErr;

    // Upsert weekly summaries
    const weeklySummaries = (profiles || []).map((p: any) => {
      const snaps = allSnapshots.filter((s) => s.profile_id === p.id);
      const totalPaid = snaps.reduce((s, sn) => s + sn.paid_minutes, 0);
      const totalOT = snaps.reduce((s, sn) => s + sn.overtime_minutes, 0);
      const totalExc = snaps.reduce((s, sn) => s + sn.exceptions.length, 0);
      const empType = snaps[0]?.employee_type || "workshop";
      return {
        profile_id: p.id,
        week_start,
        week_end: weekEnd,
        employee_type: empType,
        total_paid_hours: +(totalPaid / 60).toFixed(2),
        regular_hours: +((totalPaid - totalOT) / 60).toFixed(2),
        overtime_hours: +(totalOT / 60).toFixed(2),
        total_exceptions: totalExc,
        status: "draft",
        company_id,
      };
    });

    const { error: wsErr } = await supabase
      .from("payroll_weekly_summary")
      .upsert(weeklySummaries, { onConflict: "profile_id,week_start" });
    if (wsErr) throw wsErr;

    return new Response(
      JSON.stringify({
        success: true,
        employees_processed: profiles!.length,
        snapshots_created: allSnapshots.length,
        week: { start: week_start, end: weekEnd },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Payroll engine error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
