import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { name, existingProfileId } = ctx.body;
    if (!name || name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Name is required (min 2 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmedName = name.trim();
    let profileId: string;

    if (existingProfileId) {
      profileId = existingProfileId;
      console.log("[kiosk-register] user selected existing profile:", profileId, trimmedName);
    } else {
      const { data: existingProfile } = await ctx.serviceClient
        .from("profiles")
        .select("id")
        .eq("company_id", ctx.companyId)
        .ilike("full_name", trimmedName)
        .maybeSingle();

      if (existingProfile) {
        profileId = existingProfile.id;
        console.log("[kiosk-register] matched existing profile:", profileId, trimmedName);
      } else {
        const { data: profile, error: profileErr } = await ctx.serviceClient
          .from("profiles")
          .insert({ full_name: trimmedName, is_active: true, company_id: ctx.companyId })
          .select("id")
          .single();

        if (profileErr || !profile) {
          console.error("[kiosk-register] profile insert error:", profileErr);
          return new Response(JSON.stringify({ error: profileErr?.message || "Failed to create profile" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        profileId = profile.id;
      }
    }

    // Clock in
    const { error: clockErr } = await ctx.serviceClient
      .from("time_clock_entries")
      .insert({ profile_id: profileId, source: "kiosk" });

    if (clockErr) {
      console.error("[kiosk-register] clock in error:", clockErr);
    }

    return { profile_id: profileId, name: trimmedName };
  }, {
    functionName: "kiosk-register",
    requireCompany: true,
    requireAnyRole: ["admin", "workshop", "shop_supervisor"],
    wrapResult: false,
  })
);
