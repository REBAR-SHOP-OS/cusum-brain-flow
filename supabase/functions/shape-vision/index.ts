import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;

    // Rate limit: 10 requests per 60 seconds per user
    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: allowed } = await svcClient.rpc("check_rate_limit", {
      _user_id: userId,
      _function_name: "shape-vision",
      _max_requests: 10,
      _window_seconds: 60,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageUrl, shapeCode, action } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (action === "analyze") {
      // Analyze an uploaded schematic image to identify ASA shape code
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are an expert in ASA (Australian Standard) rebar shape codes used in steel reinforcement fabrication. 
Your job is to analyze images of rebar shapes/schematics and identify the correct ASA shape code.

Common ASA shape codes:
- S/STR: Straight bar
- 1: Hooked one end (90° or 180°)
- 2: U-shape / Hairpin
- 3: Offset / Crane hook
- 4: T1 Stirrup / Rectangular tie
- 5: Double crane / Z-shape
- 6: L-shape with hook
- 7: Trapezoidal stirrup
- 8: Complex bend
- 17: L-shape (right angle)
- T3: Hoop / Spiral
- S1-S15: Special shapes
- T1-T17: T-series shapes

Respond with ONLY a JSON object: {"shape_code": "CODE", "confidence": 0.0-1.0, "description": "brief description of the shape"}`
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Analyze this rebar schematic image and identify the ASA shape code." },
                { type: "image_url", image_url: { url: imageUrl } }
              ]
            }
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await response.text();
        console.error("AI gateway error:", response.status, errText);
        throw new Error("AI analysis failed");
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      
      // Parse the JSON response
      let result;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { shape_code: "unknown", confidence: 0, description: content };
      } catch {
        result = { shape_code: "unknown", confidence: 0, description: content };
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "assign") {
      // AI Vision Assign: analyze multiple shape images to suggest mappings
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are an expert in ASA rebar shape classification for machine routing in a steel fabrication shop.
Given a shape code, provide machine routing guidance:
- Which machine type can fabricate this shape (cutter, bender, or both)
- Required bending angles and sequence
- Any special considerations

Respond with JSON: {"routing": {"machine_type": "bender|cutter|both", "bend_count": N, "notes": "..."}}`
            },
            {
              role: "user",
              content: `Provide machine routing guidance for ASA shape code: ${shapeCode || "4"}`
            }
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("AI assignment failed");
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      
      let result;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { routing: { machine_type: "both", bend_count: 0, notes: content } };
      } catch {
        result = { routing: { machine_type: "both", bend_count: 0, notes: content } };
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("shape-vision error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
