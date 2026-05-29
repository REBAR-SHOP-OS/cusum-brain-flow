// Public read-only exporter for the ASA Shape Library.
// Consumed by external projects (e.g. RebarForge Pro) via:
//   Authorization: Bearer <IMPORT_ADMIN_SECRET>
//
// Returns: { count, shapes: [{ shape_code, image_url, ai_analysis, updated_at }] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IMPORT_SECRET = Deno.env.get("IMPORT_ADMIN_SECRET") ?? "";
const BUCKET = "shape-schematics";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toPublicUrl(imageUrl: string): string {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http")) return imageUrl;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${imageUrl.split("/").map(encodeURIComponent).join("/")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Bearer-token auth against IMPORT_ADMIN_SECRET
  if (!IMPORT_SECRET) {
    return json({ error: "IMPORT_ADMIN_SECRET not configured on server" }, 500);
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== IMPORT_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("custom_shape_schematics")
    .select("shape_code, image_url, ai_analysis, created_at")
    .order("shape_code", { ascending: true });

  if (error) return json({ error: error.message }, 500);

  const shapes = (data ?? []).map((s) => ({
    shape_code: s.shape_code,
    image_url: toPublicUrl(s.image_url),
    ai_analysis: s.ai_analysis ?? null,
    updated_at: s.created_at,
  }));

  return json({ count: shapes.length, shapes });
});
