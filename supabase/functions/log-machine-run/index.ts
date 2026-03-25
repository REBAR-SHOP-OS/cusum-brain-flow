import { handleRequest } from "../_shared/requestHandler.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, userClient: supabaseUser, serviceClient: supabaseService, body: rawBody } = ctx;

    // Role check
    const { data: userRoles } = await supabaseService
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles = (userRoles || []).map((r: { role: string }) => r.role);
    const allowedRoles = ["admin", "sales", "accounting", "workshop", "field"];
    const hasAllowedRole = roles.some((r: string) => allowedRoles.includes(r));
    if (!hasAllowedRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden: insufficient role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const {
      machineRunId, companyId, workOrderId, machineId,
      operatorProfileId, supervisorProfileId, process, status,
      startedAt, endedAt, inputQty, outputQty, scrapQty, notes, createdBy,
    } = parsed.data;

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

    let machineRun;

    if (machineRunId) {
      const { data, error } = await supabaseUser!
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
      const { data, error } = await supabaseUser!
        .from("machine_runs")
        .insert(row)
        .select()
        .single();

      if (error) throw error;
      machineRun = data;
    }

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

    await supabaseService.from("activity_events").insert({
      entity_type: "machine_run",
      entity_id: machineRun.id,
      event_type: "machine_run_updated",
      actor_id: userId,
      actor_type: "user",
      description: `Machine run ${machineRunId ? "updated" : "created"}: ${process} → ${status}`,
      metadata: eventPayload,
      source: "system",
      dedupe_key: `machine_run:${machineRun.id}:${status}:${machineRun.started_at || ""}`,
      inputs_snapshot: eventPayload,
    });

    return new Response(
      JSON.stringify({ machineRun, event: "logged" }),
      { status: machineRunId ? 200 : 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }, { functionName: "log-machine-run", requireCompany: false, wrapResult: false })
);
