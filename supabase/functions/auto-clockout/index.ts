import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Parse mode from request body
    let mode = "morning";
    try {
      const body = await req.json();
      if (body?.mode) mode = body.mode;
    } catch {
      // default to morning if no body
    }

    // Get current ET time info
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayET = etFormatter.format(now);

    const etHourFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    });
    const currentETHour = parseInt(etHourFormatter.format(now));

    if (mode === "morning") {
      // Morning mode: verify it's actually ~8 AM ET (allow 7-9 range for DST safety)
      if (currentETHour < 7 || currentETHour > 9) {
        return new Response(
          JSON.stringify({ ok: true, skipped: true, message: `Skipped: current ET hour is ${currentETHour}, not 8 AM` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Close ALL open shifts for everyone
      const { data: openShifts, error: fetchErr } = await supabase
        .from("time_clock_entries")
        .select("id, profile_id")
        .is("clock_out", null);

      if (fetchErr) throw fetchErr;

      if (!openShifts || openShifts.length === 0) {
        return new Response(
          JSON.stringify({ ok: true, closed: 0, message: "Morning reset: no open shifts" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const clockOutTime = new Date().toISOString();
      const idsToClose = openShifts.map((e: any) => e.id);

      const { error: updateErr } = await supabase
        .from("time_clock_entries")
        .update({
          clock_out: clockOutTime,
          notes: "[auto-closed: 8 AM morning reset]",
        })
        .in("id", idsToClose);

      if (updateErr) throw updateErr;

      // Set ALL affected profiles inactive
      const profileIds = [...new Set(openShifts.map((e: any) => e.profile_id))];
      await supabase
        .from("profiles")
        .update({ is_active: false })
        .in("id", profileIds);

      console.log(`Morning reset: closed ${idsToClose.length} shifts at ${clockOutTime}`);

      return new Response(
        JSON.stringify({ ok: true, mode: "morning", closed: idsToClose.length, clock_out_time: clockOutTime }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      // Evening mode: existing behavior — close only @rebar.shop office users (except kourosh)
      const etOffset = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        timeZoneName: "shortOffset",
      }).formatToParts(now).find(p => p.type === "timeZoneName")?.value;

      const offsetMatch = etOffset?.match(/GMT([+-]\d+)/);
      const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : -5;
      const fivePmUTC = new Date(`${todayET}T17:00:00.000Z`);
      fivePmUTC.setHours(fivePmUTC.getHours() - offsetHours);
      const clockOutTime = fivePmUTC.toISOString();

      const { data: openShifts, error: fetchErr } = await supabase
        .from("time_clock_entries")
        .select("id, profile_id, profiles!inner(email)")
        .is("clock_out", null);

      if (fetchErr) throw fetchErr;

      const toClose = (openShifts || []).filter((entry: any) => {
        const email = entry.profiles?.email?.toLowerCase() || "";
        return email.endsWith("@rebar.shop") && email !== "kourosh@rebar.shop";
      });

      if (toClose.length === 0) {
        return new Response(
          JSON.stringify({ ok: true, mode: "evening", closed: 0, message: "No open shifts to auto-close" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const idsToClose = toClose.map((e: any) => e.id);

      const { error: updateErr } = await supabase
        .from("time_clock_entries")
        .update({
          clock_out: clockOutTime,
          notes: "[auto-closed: 5 PM auto clock-out]",
        })
        .in("id", idsToClose);

      if (updateErr) throw updateErr;

      const profileIds = toClose.map((e: any) => e.profile_id);
      await supabase
        .from("profiles")
        .update({ is_active: false })
        .in("id", profileIds);

      console.log(`Evening auto clock-out: closed ${idsToClose.length} shifts at ${clockOutTime}`);

      return new Response(
        JSON.stringify({ ok: true, mode: "evening", closed: idsToClose.length, clock_out_time: clockOutTime }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("auto-clockout error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
