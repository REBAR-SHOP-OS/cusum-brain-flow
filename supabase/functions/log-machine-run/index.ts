import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User-scoped client (respects RLS)
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client (for role checks & event logging)
    const supabaseService = createClient(supabaseUrl, serviceKey);

    // Validate JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub as string;

    // ── Role check: block 'office' role ──────────────────────────────
    const { data: userRoles } = await supabaseService
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles = (userRoles || []).map((r: { role: string }) => r.role);

    // If user ONLY has 'office' role (or no roles at all), deny
    const allowedRoles = ["admin", "sales", "accounting", "workshop", "field"];
    const hasAllowedRole = roles.some((r: string) => allowedRoles.includes(r));
    if (!hasAllowedRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden: insufficient role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Parse body ───────────────────────────────────────────────────
    const bodySchema = z.object({
      machineRunId: z.string().uuid().optional(),
      companyId: z.string().uuid(),
      machineId: z.string().uuid(),
      workOrderId: z.string().uuid().optional().nullable(),
      operatorProfileId: z.string().uuid().optional().nullable(),
      supervisorProfileId: z.string().uuid().optional().nullable(),
      process: z.enum(["cut", "bend", "load", "pickup", "delivery", "clearance", "other"]),
      status: z.enum(["queued", "running", "paused", "blocked", "completed", "rejected", "canceled"]),
      startedAt: z.string().optional().nullable(),
      endedAt: z.string().optional().nullable(),
      inputQty: z.number().nonnegative().optional().nullable(),
      outputQty: z.number().nonnegative().optional().nullable(),
      scrapQty: z.number().nonnegative().optional().nullable(),
      notes: z.string().max(2000).optional().nullable(),
      createdBy: z.string().uuid().optional().nullable(),
    });
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const {
      machineRunId,
      companyId,
      workOrderId,
      machineId,
      operatorProfileId,
      supervisorProfileId,
      process,
      status,
      startedAt,
      endedAt,
      inputQty,
      outputQty,
      scrapQty,
      notes,
      createdBy,
    } = parsed.data;

    // ── Build row payload ────────────────────────────────────────────
    const row: Record<string, unknown> = {
      company_id: companyId,
      machine_id: machineId,
      process,
      status,
    };
    if (workOrderId !== undefined) row.work_order_id = workOrderId;
    if (operatorProfileId !== undefined) row.operator_profile_id = operatorProfileId;
    if (supervisorProfileId !== undefined) row.supervisor_profile_id = supervisorProfileId;
    if (startedAt !== undefined) row.started_at = startedAt;
    if (endedAt !== undefined) row.ended_at = endedAt;
    if (inputQty !== undefined) row.input_qty = inputQty;
    if (outputQty !== undefined) row.output_qty = outputQty;
    if (scrapQty !== undefined) row.scrap_qty = scrapQty;
    if (notes !== undefined) row.notes = notes;
    if (createdBy !== undefined) row.created_by = createdBy;

    // ── Insert or update ─────────────────────────────────────────────
    let machineRun;

    if (machineRunId) {
      // Update existing run (via user client for RLS)
      const { data, error } = await supabaseUser
        .from("machine_runs")
        .update(row)
        .eq("id", machineRunId)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return new Response(
          JSON.stringify({ error: "Machine run not found or access denied" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      machineRun = data;
    } else {
      // Insert new run (via user client for RLS)
      const { data, error } = await supabaseUser
        .from("machine_runs")
        .insert(row)
        .select()
        .single();

      if (error) throw error;
      machineRun = data;
    }

    // ── Log event ────────────────────────────────────────────────────
    const eventPayload = {
      machineRunId: machineRun.id,
      machineId: machineRun.machine_id,
      status: machineRun.status,
      process: machineRun.process,
      startedAt: machineRun.started_at,
      endedAt: machineRun.ended_at,
      inputQty: machineRun.input_qty,
      outputQty: machineRun.output_qty,
      scrapQty: machineRun.scrap_qty,
    };

    await supabaseService.from("events").insert({
      entity_type: "machine_run",
      entity_id: machineRun.id,
      event_type: "machine_run_updated",
      actor_id: userId,
      actor_type: "user",
      description: `Machine run ${machineRunId ? "updated" : "created"}: ${process} → ${status}`,
      metadata: eventPayload,
    });

    return new Response(
      JSON.stringify({ machineRun, event: "logged" }),
      { status: machineRunId ? 200 : 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("logMachineRunEvent error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
