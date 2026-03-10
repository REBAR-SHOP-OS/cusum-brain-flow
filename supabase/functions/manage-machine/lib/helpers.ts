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

export async function logProductionEvent(
  supabaseService: ReturnType<typeof createClient>,
  companyId: string,
  eventType: string,
  metadata: Record<string, unknown>,
  description: string,
  entityId?: string,
  actorId?: string,
) {
  try {
    await supabaseService.from("production_events").insert({
      company_id: companyId,
      event_type: eventType,
      metadata,
      machine_id: metadata.machineId || null,
      session_id: metadata.sessionId || null,
      row_id: metadata.rowId || null,
      batch_id: metadata.batchId || null,
      triggered_by: actorId || null,
    });
  } catch (err) {
    console.error(`Failed to log production event ${eventType}:`, err);
  }
}

export async function flushEvents(
  supabaseService: ReturnType<typeof createClient>,
  events: Record<string, unknown>[],
  companyId: string,
) {
  if (events.length === 0) return;
  const { error } = await supabaseService
    .from("activity_events")
    .insert(events.map((e: any) => ({ ...e, source: "system", company_id: companyId })));
  if (error) console.error("Failed to log events:", error);
}

export interface ActionContext {
  userId: string;
  machineId: string;
  machine: any;
  body: any;
  roles: string[];
  supabaseUser: ReturnType<typeof createClient>;
  supabaseService: ReturnType<typeof createClient>;
  events: Record<string, unknown>[];
  now: string;
}
