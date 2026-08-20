import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function logEvent(
  sb: ReturnType<typeof createClient>,
  companyId: string,
  eventType: string,
  metadata: Record<string, unknown>,
  description: string,
  actorId?: string,
) {
  try {
    await sb.from("production_events").insert({
      company_id: companyId,
      event_type: eventType,
      metadata,
      machine_id: metadata.machineId || null,
      batch_id: metadata.batchId || null,
      triggered_by: actorId || null,
    });
  } catch (err) {
    console.error(`Failed to log ${eventType}:`, err);
  }
}

export interface BendContext {
  userId: string;
  body: any;
  supabaseUser: ReturnType<typeof createClient>;
  sb: ReturnType<typeof createClient>;
}
