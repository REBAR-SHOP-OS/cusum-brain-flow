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

    // Check role (workshop or admin)
    const svc = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = (roles || []).map((r: any) => r.role);
    if (!userRoles.includes("admin") && !userRoles.includes("workshop") && !userRoles.includes("shop_supervisor")) {
      return new Response(JSON.stringify({ error: "Forbidden: requires workshop or admin role" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller's company_id
    const { data: callerProfile } = await svc
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!callerProfile?.company_id) {
      return new Response(JSON.stringify({ error: "No company found for caller" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, faceBase64 } = await req.json();
    if (!name || name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Name is required (min 2 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmedName = name.trim();

    // 1. Try to match existing profile by name (case-insensitive) in same company
    const { data: existingProfile } = await svc
      .from("profiles")
      .select("id")
      .eq("company_id", callerProfile.company_id)
      .ilike("full_name", trimmedName)
      .maybeSingle();

    let profileId: string;

    if (existingProfile) {
      // Use existing profile
      profileId = existingProfile.id;
      console.log("[kiosk-register] matched existing profile:", profileId, trimmedName);
    } else {
      // Create new profile
      const { data: profile, error: profileErr } = await svc
        .from("profiles")
        .insert({ full_name: trimmedName, is_active: true, company_id: callerProfile.company_id })
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

    // 2. Upload face photo & create enrollment
    if (faceBase64) {
      const filePath = `${profileId}/enroll-${Date.now()}.jpg`;
      const byteArray = Uint8Array.from(atob(faceBase64), (c) => c.charCodeAt(0));

      const { error: uploadErr } = await svc.storage
        .from("face-enrollments")
        .upload(filePath, byteArray, { contentType: "image/jpeg" });

      if (!uploadErr) {
        await svc.from("face_enrollments").insert({ profile_id: profileId, photo_url: filePath });
      } else {
        console.error("[kiosk-register] upload error:", uploadErr);
      }
    }

    // 3. Clock in
    const { error: clockErr } = await svc
      .from("time_clock_entries")
      .insert({ profile_id: profileId, source: "kiosk" });

    if (clockErr) {
      console.error("[kiosk-register] clock in error:", clockErr);
    }

    return new Response(JSON.stringify({ profile_id: profileId, name: trimmedName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[kiosk-register] exception:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
