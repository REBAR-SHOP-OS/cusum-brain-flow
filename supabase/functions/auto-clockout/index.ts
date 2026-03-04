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

    // Get 5 PM Eastern today in ISO format
    // Eastern Time is UTC-5 (EST) or UTC-4 (EDT)
    // We use America/New_York to handle DST automatically
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayET = etFormatter.format(now); // YYYY-MM-DD in ET

    // 5:00 PM Eastern as UTC
    const fivePmET = new Date(`${todayET}T17:00:00`);
    // Get the UTC offset for today in Eastern time
    const etOffset = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "shortOffset",
    }).formatToParts(now).find(p => p.type === "timeZoneName")?.value;

    // Parse offset like "GMT-5" or "GMT-4"
    const offsetMatch = etOffset?.match(/GMT([+-]\d+)/);
    const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : -5;
    const fivePmUTC = new Date(`${todayET}T17:00:00.000Z`);
    fivePmUTC.setHours(fivePmUTC.getHours() - offsetHours);

    const clockOutTime = fivePmUTC.toISOString();

    // Find all open shifts for @rebar.shop users except kourosh@rebar.shop
    const { data: openShifts, error: fetchErr } = await supabase
      .from("time_clock_entries")
      .select("id, profile_id, profiles!inner(email)")
      .is("clock_out", null);

    if (fetchErr) throw fetchErr;

    // Filter to @rebar.shop emails, excluding kourosh
    const toClose = (openShifts || []).filter((entry: any) => {
      const email = entry.profiles?.email?.toLowerCase() || "";
      return email.endsWith("@rebar.shop") && email !== "kourosh@rebar.shop";
    });

    if (toClose.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, closed: 0, message: "No open shifts to auto-close" }),
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

    console.log(`Auto clock-out: closed ${idsToClose.length} shifts at ${clockOutTime}`);

    return new Response(
      JSON.stringify({ ok: true, closed: idsToClose.length, clock_out_time: clockOutTime }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("auto-clockout error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
