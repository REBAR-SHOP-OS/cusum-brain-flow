import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check role
    const svc = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = (roles || []).map((r: any) => r.role);
    if (!userRoles.includes("admin") && !userRoles.includes("workshop") && !userRoles.includes("shop_supervisor")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { profileId, faceBase64 } = await req.json();
    if (!profileId) {
      return new Response(JSON.stringify({ error: "profileId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce 8 AM ET clock-in restriction for @rebar.shop users
    const { data: profileData } = await svc
      .from("profiles")
      .select("email")
      .eq("id", profileId)
      .single();

    const profileEmail = (profileData?.email || "").toLowerCase();
    const isRebarUser = profileEmail.endsWith("@rebar.shop") && profileEmail !== "kourosh@rebar.shop";

    // Check for open shift
    const { data: openShifts } = await svc
      .from("time_clock_entries")
      .select("id")
      .eq("profile_id", profileId)
      .is("clock_out", null);

    let action: "clock_in" | "clock_out";

    if (openShifts && openShifts.length > 0) {
      // Clock out — close all open shifts
      const { error } = await svc
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
      action = "clock_out";
    } else {
      // Clock in
      const { error } = await svc
        .from("time_clock_entries")
        .insert({ profile_id: profileId });

      if (error) {
        console.error("[kiosk-punch] clock in error:", error);
        return new Response(JSON.stringify({ error: "Failed to clock in" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      action = "clock_in";
    }

    // Auto-enroll face if < 3 photos
    if (faceBase64) {
      try {
        const { count } = await svc
          .from("face_enrollments")
          .select("*", { count: "exact", head: true })
          .eq("profile_id", profileId);

        if ((count || 0) < 3) {
          const filePath = `${profileId}/auto-${Date.now()}.jpg`;
          const byteArray = Uint8Array.from(atob(faceBase64), (c) => c.charCodeAt(0));

          const { error: uploadErr } = await svc.storage
            .from("face-enrollments")
            .upload(filePath, byteArray, { contentType: "image/jpeg" });

          if (!uploadErr) {
            await svc.from("face_enrollments").insert({ profile_id: profileId, photo_url: filePath });
          }
        }
      } catch (err) {
        console.error("[kiosk-punch] auto-enroll error:", err);
      }
    }

    return new Response(JSON.stringify({ action, profile_id: profileId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[kiosk-punch] exception:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
