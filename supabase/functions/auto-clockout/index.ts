import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse mode from request body — REQUIRED, no default
    let mode: string | null = null;
    try {
      const body = await req.json();
      if (body?.mode) mode = body.mode;
    } catch {
      // no body — mode stays null
    }

    if (!mode || !["morning", "evening"].includes(mode)) {
      console.log(`BLOCKED: auto-clockout called with invalid/missing mode: ${mode}`);
      return new Response(
        JSON.stringify({ ok: false, error: "Missing or invalid mode. Must be 'morning' or 'evening'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      // HARD GUARD: only execute between 5-7 AM ET
      if (currentETHour < 5 || currentETHour > 7) {
        console.log(`BLOCKED: morning reset rejected at ET hour ${currentETHour}`);
        return new Response(
          JSON.stringify({ 
            ok: false, 
            blocked: true, 
            message: `Morning reset blocked — current ET hour is ${currentETHour}, only allowed 5-7 AM ET` 
          }),
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
          notes: "[auto-closed: 6 AM morning reset]",
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
      // HARD GUARD: only execute between 5-7 PM ET (17-19)
      if (currentETHour < 17 || currentETHour > 19) {
        console.log(`BLOCKED: evening auto clock-out rejected at ET hour ${currentETHour}`);
        return new Response(
          JSON.stringify({ 
            ok: false, 
            blocked: true, 
            message: `Evening auto clock-out blocked — current ET hour is ${currentETHour}, only allowed 5-7 PM ET` 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Evening mode: close ONLY office worker shifts at 6 PM ET
      // Shop workers (non-@rebar.shop emails OR Kourosh Zand) are exempt
      const clockOutTime = new Date().toISOString();

      const { data: openShifts, error: fetchErr } = await supabase
        .from("time_clock_entries")
        .select("id, profile_id, profiles!inner(email, full_name)")
        .is("clock_out", null);

      if (fetchErr) throw fetchErr;

      if (!openShifts || openShifts.length === 0) {
        return new Response(
          JSON.stringify({ ok: true, mode: "evening", closed: 0, exempted: 0, message: "No open shifts" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Split into office vs shop workers
      const officeShifts: any[] = [];
      const shopExempted: any[] = [];

      for (const shift of openShifts) {
        const profile = (shift as any).profiles;
        const email = (profile?.email || "").toLowerCase();
        const fullName = (profile?.full_name || "");
        const isOffice = email.endsWith("@rebar.shop") && fullName !== "Kourosh Zand";

        if (isOffice) {
          officeShifts.push(shift);
        } else {
          shopExempted.push(shift);
        }
      }

      if (shopExempted.length > 0) {
        console.log(`Evening: exempted ${shopExempted.length} shop worker shifts:`,
          shopExempted.map((s: any) => (s as any).profiles?.full_name));
      }

      if (officeShifts.length === 0) {
        return new Response(
          JSON.stringify({ ok: true, mode: "evening", closed: 0, exempted: shopExempted.length, message: "Only shop workers have open shifts — exempted" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const idsToClose = officeShifts.map((e: any) => e.id);

      const { error: updateErr } = await supabase
        .from("time_clock_entries")
        .update({
          clock_out: clockOutTime,
          notes: "[auto-closed: 6 PM auto clock-out]",
        })
        .in("id", idsToClose);

      if (updateErr) throw updateErr;

      const profileIds = [...new Set(officeShifts.map((e: any) => e.profile_id))];
      await supabase
        .from("profiles")
        .update({ is_active: false })
        .in("id", profileIds);

      console.log(`Evening 6 PM auto clock-out: closed ${idsToClose.length} office shifts, exempted ${shopExempted.length} shop workers`);

      return new Response(
        JSON.stringify({ ok: true, mode: "evening", closed: idsToClose.length, exempted: shopExempted.length, clock_out_time: clockOutTime }),
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
