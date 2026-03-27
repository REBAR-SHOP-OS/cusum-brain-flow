import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { profileId } = ctx.body;
    if (!profileId) {
      return new Response(JSON.stringify({ error: "profileId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for open shift
    const { data: openShifts } = await ctx.serviceClient
      .from("time_clock_entries")
      .select("id")
      .eq("profile_id", profileId)
      .is("clock_out", null);

    let action: "clock_in" | "clock_out";

    if (openShifts && openShifts.length > 0) {
      // Clock out — close all open shifts
      const { error } = await ctx.serviceClient
        .from("time_clock_entries")
        .update({ clock_out: new Date().toISOString() })
        .eq("profile_id", profileId)
        .is("clock_out", null);

      if (error) {
        console.error("[kiosk-punch] clock out error:", error);
        return new Response(JSON.stringify({ error: "Failed to clock out" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await ctx.serviceClient.from("profiles").update({ is_active: false }).eq("id", profileId);
      action = "clock_out";
    } else {
      // Enforce 6 AM ET restriction
      const nowET = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
      if (nowET.getHours() < 6) {
        return new Response(JSON.stringify({ error: "Clock-in is only available from 6:00 AM ET" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await ctx.serviceClient
        .from("time_clock_entries")
        .insert({ profile_id: profileId, source: "kiosk" });

      if (error) {
        console.error("[kiosk-punch] clock in error:", error);
        return new Response(JSON.stringify({ error: "Failed to clock in" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await ctx.serviceClient.from("profiles").update({ is_active: true }).eq("id", profileId);
      action = "clock_in";
    }


    return { action, profile_id: profileId };
  }, {
    functionName: "kiosk-punch",
    requireCompany: false,
    requireAnyRole: ["admin", "workshop", "shop_supervisor"],
    wrapResult: false,
  })
);
