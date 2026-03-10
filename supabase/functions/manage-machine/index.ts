import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders, json, flushEvents, type ActionContext } from "./lib/helpers.ts";
import { handleUpdateStatus } from "./handlers/updateStatus.ts";
import { handleAssignOperator } from "./handlers/assignOperator.ts";
import { handleStartRun } from "./handlers/startRun.ts";
import { handleStartQueuedRun } from "./handlers/startQueuedRun.ts";
import { handlePauseBlockComplete } from "./handlers/completeRun.ts";
import { handleSupervisorUnlock } from "./handlers/supervisorUnlock.ts";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseService = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Invalid token" }, 401);
    const userId = claimsData.claims.sub as string;

    // ── Role check ──
    const { data: userRoles } = await supabaseService.from("user_roles").select("role").eq("user_id", userId);
    const roles = (userRoles || []).map((r: { role: string }) => r.role);
    if (!roles.some((r: string) => ["admin", "workshop"].includes(r))) {
      return json({ error: "Forbidden: insufficient role" }, 403);
    }

    // ── Parse body ──
    const topSchema = z.object({
      action: z.string().min(1).max(50),
      machineId: z.string().uuid("machineId must be a valid UUID"),
    }).passthrough();
    const parsed = topSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
    }
    const body = parsed.data;
    const { action, machineId } = body;

    const { data: machine, error: machineError } = await supabaseUser
      .from("machines").select("*").eq("id", machineId).single();
    if (machineError || !machine) return json({ error: "Machine not found or access denied" }, 404);

    const now = new Date().toISOString();
    const events: Record<string, unknown>[] = [];
    let machineRunId: string | null = null;

    const ctx: ActionContext = {
      userId, machineId, machine, body, roles,
      supabaseUser, supabaseService, events, now,
    };

    switch (action) {
      case "update-status": {
        const resp = await handleUpdateStatus(ctx);
        if (resp) return resp;
        break;
      }
      case "assign-operator": {
        const resp = await handleAssignOperator(ctx);
        if (resp) return resp;
        break;
      }
      case "start-run": {
        const result = await handleStartRun(ctx);
        if (result.response) return result.response;
        machineRunId = result.machineRunId || null;
        break;
      }
      case "start-queued-run": {
        const result = await handleStartQueuedRun(ctx);
        if (result.response) return result.response;
        machineRunId = result.machineRunId || null;
        break;
      }
      case "pause-run":
      case "block-run":
      case "complete-run": {
        const resp = await handlePauseBlockComplete(ctx, action);
        if (resp) return resp;
        break;
      }
      case "supervisor-unlock": {
        const resp = await handleSupervisorUnlock(ctx);
        if (resp) return resp;
        break;
      }
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }

    // ── Write events ──
    await flushEvents(supabaseService, events, machine.company_id);

    return json({ success: true, machineId, action, machineRunId: machineRunId ?? undefined });
  } catch (error) {
    console.error("manage-machine error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
