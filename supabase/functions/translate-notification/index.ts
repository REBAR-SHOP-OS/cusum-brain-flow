import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { translateNotification } from "../_shared/notifyTranslate.ts";
import { corsHeaders } from "../_shared/auth.ts";

/**
 * translate-notification
 * Called by a DB trigger on INSERT into notifications.
 * Fetches the recipient's preferred_language from profiles.
 * If not "en", translates title + description and updates the row.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Translation disabled — all notifications must be English-only
    return new Response(
      JSON.stringify({ skipped: "translation disabled" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("translate-notification error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
