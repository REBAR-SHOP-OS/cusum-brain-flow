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
      // Morning mode: close ALL open shifts (no hour guard — works for cron and manual calls)
      if (currentETHour < 5 || currentETHour > 7) {
        console.log(`Warning: morning reset called at ET hour ${currentETHour} (expected ~6 AM)`);
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
