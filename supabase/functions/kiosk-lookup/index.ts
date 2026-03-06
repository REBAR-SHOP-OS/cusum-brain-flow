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

    // Get caller's company_id
    const svc = createClient(supabaseUrl, serviceKey);
    const { data: callerProfile } = await svc
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!callerProfile?.company_id) {
      return new Response(JSON.stringify({ error: "No company found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name } = await req.json();
    const trimmed = (name || "").trim();
    if (trimmed.length < 2) {
      return new Response(JSON.stringify({ candidates: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build fuzzy search: match any word in the input against full_name
    const words = trimmed.split(/\s+/).filter((w: string) => w.length >= 2);
    
    // Use OR conditions: full_name ILIKE '%word%' for each word
    // We'll query with the full name first, then individual words
    const patterns = [
      `%${trimmed}%`,
      ...words.map((w: string) => `%${w}%`),
    ];

    // Remove duplicates
    const uniquePatterns = [...new Set(patterns)];

    // Query profiles matching any pattern
    let allMatches: any[] = [];
    const seenIds = new Set<string>();

    for (const pattern of uniquePatterns) {
      const { data } = await svc
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("company_id", callerProfile.company_id)
        .eq("is_active", true)
        .ilike("full_name", pattern)
        .limit(10);

      if (data) {
        for (const row of data) {
          if (!seenIds.has(row.id)) {
            seenIds.add(row.id);
            allMatches.push(row);
          }
        }
      }
    }

    // Return top 5
    const candidates = allMatches.slice(0, 5).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
    }));

    console.log(`[kiosk-lookup] query="${trimmed}" found ${candidates.length} candidates`);

    return new Response(JSON.stringify({ candidates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[kiosk-lookup] error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
