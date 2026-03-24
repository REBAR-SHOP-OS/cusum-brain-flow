
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cropToAspectRatio } from "./imageResize.ts";

export async function executeToolCall(
  toolCall: any, 
  agent: string, 
  user: any, 
  companyId: string, 
  svcClient: ReturnType<typeof createClient>, 
  context: any,
  authHeader: string
) {
  const result: any = { tool_call_id: toolCall.id, result: {}, sideEffects: {} };
  const name = toolCall.function.name;
  let args: any = {};
  
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    return { ...result, result: { error: "Invalid JSON arguments" } };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  try {
    // 1. Notifications
    if (name === "create_notifications") {
      const items = args.items || [];
      const notifications: any[] = [];
      
      for (const item of items) {
        let assignedTo = null;
        if (item.assigned_to_name && context.availableEmployees) {
          const match = context.availableEmployees.find((e: any) => e.name.toLowerCase().includes(item.assigned_to_name.toLowerCase()));
          if (match) assignedTo = match.id;
        }

        const { error } = await svcClient.from("notifications").insert({
          user_id: user.id,
          type: item.type || "todo",
          title: item.title,
          description: item.description,
          priority: item.priority || "normal",
          assigned_to: assignedTo,
          status: "unread",
          agent_name: agent,
          metadata: { created_by_agent: agent }
        });

        if (!error) notifications.push(item);
      }
      result.result = { success: true, count: notifications.length };
      result.sideEffects.notifications = notifications;
    }

    // 2. Send Email
    else if (name === "send_email") {
      const emailRes = await fetch(
        `${supabaseUrl}/functions/v1/gmail-send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": authHeader },
          body: JSON.stringify(args)
        }
      );
      if (emailRes.ok) {
        result.result = { success: true, to: args.to };
        result.sideEffects.emails = [{ to: args.to }];
      } else {
        result.result = { success: false, error: await emailRes.text() };
      }
    }

    // 3. DB Read (Empire)
    else if (name === "db_read_query") {
      const { data, error } = await svcClient.rpc("execute_readonly_query", { sql_query: args.query });
      result.result = error ? { error: error.message } : { success: true, rows: data };
    }

    // 4. DB Write (Empire)
    else if (name === "db_write_fix") {
      const { error } = await svcClient.rpc("execute_write_fix", { sql_query: args.query });
      result.result = error ? { error: error.message } : { success: true, message: "Query executed" };
    }

    // 5. Update Machine Status
    else if (name === "update_machine_status") {
      const { data, error } = await svcClient.from("machines").update({ status: args.status }).eq("id", args.id).select();
      result.result = error ? { error: error.message } : { success: true, data };
    }

    // 5b. Get Production Report (Forge)
    else if (name === "get_production_report") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      const { data: runs } = await svcClient
        .from("machine_runs")
        .select("id, machine_id, process, status, started_at, ended_at, output_qty, scrap_qty, operator_profile_id")
        .gte("started_at", todayISO)
        .order("started_at", { ascending: false })
        .limit(100);

      const { data: machines } = await svcClient.from("machines").select("id, name").limit(50);
      const { data: profiles } = await svcClient.from("profiles").select("id, full_name").eq("is_active", true);

      const machineMap = new Map((machines || []).map((m: any) => [m.id, m.name]));
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));

      const completedRuns = (runs || []).filter((r: any) => r.status === "completed");
      const totalPieces = completedRuns.reduce((s: number, r: any) => s + (r.output_qty || 0), 0);
      const totalScrap = completedRuns.reduce((s: number, r: any) => s + (r.scrap_qty || 0), 0);

      result.result = {
        success: true,
        summary: {
          totalRunsToday: (runs || []).length,
          completedRuns: completedRuns.length,
          totalPiecesProduced: totalPieces,
          totalScrap,
        },
        runs: (runs || []).map((r: any) => ({
          machine: machineMap.get(r.machine_id) || r.machine_id,
          process: r.process,
          status: r.status,
          output_qty: r.output_qty,
          scrap_qty: r.scrap_qty,
          operator: profileMap.get(r.operator_profile_id) || "unassigned",
          started_at: r.started_at,
          ended_at: r.ended_at,
        })),
      };
    }

    // 5c. Get Work Orders (Forge)
    else if (name === "get_work_orders") {
      const statusFilter = args.status_filter;
      const mode = args.mode || "active";
      const limit = args.limit || 30;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      let query = svcClient
        .from("work_orders")
        .select("id, work_order_number, status, scheduled_start, order_id, priority, notes, created_at")
        .limit(limit);

      if (mode === "created_today") {
        query = query.gte("created_at", todayISO).order("created_at", { ascending: false });
      } else if (mode === "scheduled_today") {
        const todayDate = new Date().toISOString().split("T")[0];
        query = query.gte("scheduled_start", `${todayDate}T00:00:00`).lte("scheduled_start", `${todayDate}T23:59:59`).order("scheduled_start", { ascending: true });
      } else {
        // "active" mode (default)
        if (statusFilter) {
          query = query.eq("status", statusFilter);
        } else {
          query = query.in("status", ["queued", "pending", "in-progress"]);
        }
        query = query.order("scheduled_start", { ascending: true });
      }

      const { data: wos, error } = await query;

      // Annotate each WO with date flags
      const todayDateStr = new Date().toISOString().split("T")[0];
      const annotated = (wos || []).map((wo: any) => ({
        ...wo,
        is_created_today: wo.created_at ? wo.created_at.startsWith(todayDateStr) : false,
        is_scheduled_today: wo.scheduled_start ? wo.scheduled_start.startsWith(todayDateStr) : false,
      }));

      const createdTodayCount = annotated.filter((w: any) => w.is_created_today).length;
      const scheduledTodayCount = annotated.filter((w: any) => w.is_scheduled_today).length;

      result.result = error
        ? { error: error.message }
        : {
            success: true,
            mode,
            work_orders: annotated,
            count: annotated.length,
            created_today_count: createdTodayCount,
            scheduled_today_count: scheduledTodayCount,
          };
    }

    // 5d. Get Cut Plan Status (Forge)
    else if (name === "get_cut_plan_status") {
      const { data: plans } = await svcClient
        .from("cut_plans")
        .select("id, name, status, machine_id")
        .in("status", ["active", "in_progress", "queued"])
        .limit(20);

      const { data: items } = await svcClient
        .from("cut_plan_items")
        .select("id, phase, cut_plan_id")
        .limit(500);

      const phaseCounts: Record<string, number> = {};
      for (const item of items || []) {
        phaseCounts[item.phase] = (phaseCounts[item.phase] || 0) + 1;
      }

      result.result = {
        success: true,
        activePlans: plans || [],
        planCount: (plans || []).length,
        itemPhaseCounts: phaseCounts,
        totalItems: (items || []).length,
      };
    }

    // 5e. Get Timeclock Summary (Forge)
    else if (name === "get_timeclock_summary") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      const { data: entries } = await svcClient
        .from("time_clock_entries")
        .select("id, profile_id, clock_in, clock_out, break_minutes, notes")
        .gte("clock_in", todayISO)
        .order("clock_in", { ascending: false })
        .limit(50);

      const { data: profiles } = await svcClient.from("profiles").select("id, full_name").eq("is_active", true);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));

      const now = new Date();
      const summary = (entries || []).map((e: any) => {
        const clockIn = new Date(e.clock_in);
        const clockOut = e.clock_out ? new Date(e.clock_out) : now;
        const hoursWorked = +((clockOut.getTime() - clockIn.getTime()) / 3600000).toFixed(2);
        return {
          employee: profileMap.get(e.profile_id) || e.profile_id,
          clock_in: e.clock_in,
          clock_out: e.clock_out,
          is_active: !e.clock_out,
          hours_worked: hoursWorked,
          break_minutes: e.break_minutes || 0,
        };
      });

      result.result = {
        success: true,
        entries: summary,
        activeCount: summary.filter((s: any) => s.is_active).length,
        totalEntries: summary.length,
      };
    }
    else if (name === "run_takeoff") {
      const body: any = {
        name: args.name || args.project_name || "Untitled Takeoff",
        file_urls: args.file_urls || [],
        waste_factor_pct: args.waste_factor_pct ?? 5,
        scope_context: args.scope_context || "",
      };
      if (args.customer_id) body.customer_id = args.customer_id;
      if (args.lead_id) body.lead_id = args.lead_id;

      const takeoffRes = await fetch(`${supabaseUrl}/functions/v1/ai-estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": authHeader },
        body: JSON.stringify(body),
      });

      if (takeoffRes.ok) {
        const takeoffData = await takeoffRes.json();
        result.result = {
          success: true,
          project_id: takeoffData.project_id,
          summary: takeoffData.summary,
          message: `Takeoff complete: ${takeoffData.summary?.item_count ?? 0} items, ${takeoffData.summary?.total_weight_kg ?? 0} kg`,
        };
      } else {
        result.result = { success: false, error: await takeoffRes.text() };
      }
    }

    // ═══════════════════════════════════════════════════
    // 7. Get Estimate Summary
    // ═══════════════════════════════════════════════════
    else if (name === "get_estimate_summary") {
      const projectId = args.project_id;
      if (!projectId) {
        result.result = { error: "project_id is required" };
      } else {
        const { data: project, error: pErr } = await svcClient
          .from("estimation_projects")
          .select("*")
          .eq("id", projectId)
          .maybeSingle();

        if (pErr || !project) {
          result.result = { error: pErr?.message || "Project not found" };
        } else {
          const { data: items, error: iErr } = await svcClient
            .from("estimation_items")
            .select("*")
            .eq("project_id", projectId)
            .order("element_type", { ascending: true });

          result.result = {
            success: true,
            project,
            items: items || [],
            item_count: items?.length ?? 0,
          };
        }
      }
    }

    // ═══════════════════════════════════════════════════
    // 8. Update Estimate Item
    // ═══════════════════════════════════════════════════
    else if (name === "update_estimate_item") {
      const itemId = args.item_id || args.id;
      if (!itemId) {
        result.result = { error: "item_id is required" };
      } else {
        const updates: any = {};
        if (args.quantity !== undefined) updates.quantity = args.quantity;
        if (args.cut_length_mm !== undefined) updates.cut_length_mm = args.cut_length_mm;
        if (args.bar_size !== undefined) updates.bar_size = args.bar_size;
        if (args.mark !== undefined) updates.mark = args.mark;
        if (args.element_ref !== undefined) updates.element_ref = args.element_ref;
        if (args.element_type !== undefined) updates.element_type = args.element_type;

        const { data, error } = await svcClient
          .from("estimation_items")
          .update(updates)
          .eq("id", itemId)
          .select();

        result.result = error ? { error: error.message } : { success: true, updated: data };
      }
    }

    // ═══════════════════════════════════════════════════
    // 9. Apply Waste Factor
    // ═══════════════════════════════════════════════════
    else if (name === "apply_waste_factor") {
      const projectId = args.project_id;
      const newWaste = args.waste_factor_pct;
      if (!projectId || newWaste === undefined) {
        result.result = { error: "project_id and waste_factor_pct are required" };
      } else {
        // Fetch items
        const { data: items, error: iErr } = await svcClient
          .from("estimation_items")
          .select("*")
          .eq("project_id", projectId);

        if (iErr || !items) {
          result.result = { error: iErr?.message || "No items found" };
        } else {
          const factor = 1 + (newWaste / 100);
          let totalWeight = 0;
          let totalCost = 0;

          for (const item of items) {
            const newQty = Math.ceil((item.quantity || 0) * factor);
            const weightPerUnit = item.weight_kg && item.quantity ? item.weight_kg / item.quantity : 0;
            const newWeight = +(newQty * weightPerUnit).toFixed(2);
            const costPerUnit = item.unit_cost || 0;
            const newLineCost = +(newQty * costPerUnit).toFixed(2);

            try {
              await svcClient
                .from("estimation_items")
                .update({ quantity: newQty, weight_kg: newWeight, line_cost: newLineCost })
                .eq("id", item.id);
            } catch (_) { /* best effort */ }

            totalWeight += newWeight;
            totalCost += newLineCost;
          }

          // Update project
          try {
            await svcClient
              .from("estimation_projects")
              .update({ waste_factor_pct: newWaste, total_weight_kg: totalWeight, total_cost: totalCost })
              .eq("id", projectId);
          } catch (_) { /* best effort */ }

          result.result = {
            success: true,
            message: `Applied ${newWaste}% waste to ${items.length} items`,
            total_weight_kg: totalWeight,
            total_cost: totalCost,
          };
        }
      }
    }

    // ═══════════════════════════════════════════════════
    // 10. Convert to Quote
    // ═══════════════════════════════════════════════════
    else if (name === "convert_to_quote") {
      const body = {
        project_id: args.project_id,
        customer_id: args.customer_id,
        notes: args.notes || "",
      };

      const quoteRes = await fetch(`${supabaseUrl}/functions/v1/convert-quote-to-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": authHeader },
        body: JSON.stringify(body),
      });

      if (quoteRes.ok) {
        const quoteData = await quoteRes.json();
        result.result = { success: true, ...quoteData };
      } else {
        result.result = { success: false, error: await quoteRes.text() };
      }
    }

    // ═══════════════════════════════════════════════════
    // 11. Generate Sales Quote
    // ═══════════════════════════════════════════════════
    else if (name === "generate_sales_quote") {
      const er = args.estimate_request || args;
      // Defensive: normalize scope arrays to prevent "not iterable" crashes
      if (er?.scope) {
        er.scope.straight_rebar_lines = Array.isArray(er.scope.straight_rebar_lines) ? er.scope.straight_rebar_lines : [];
        er.scope.fabricated_rebar_lines = Array.isArray(er.scope.fabricated_rebar_lines) ? er.scope.fabricated_rebar_lines : [];
        er.scope.dowels = Array.isArray(er.scope.dowels) ? er.scope.dowels : [];
        er.scope.ties_circular = Array.isArray(er.scope.ties_circular) ? er.scope.ties_circular : [];
        er.scope.mesh = Array.isArray(er.scope.mesh) ? er.scope.mesh : [];

        // ── Cage normalization: fix LLM emitting "cages" as string or bare object ──
        if (typeof er.scope.cages === "string") {
          try {
            const parsed = JSON.parse(er.scope.cages);
            er.scope.cages = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === "object" ? [parsed] : []);
          } catch {
            console.warn("[generate_sales_quote] cages was a non-parseable string, resetting to []:", er.scope.cages);
            er.scope.cages = [];
          }
        } else if (er.scope.cages && typeof er.scope.cages === "object" && !Array.isArray(er.scope.cages)) {
          // Bare object → wrap as single-element array
          er.scope.cages = [er.scope.cages];
        } else if (!Array.isArray(er.scope.cages)) {
          er.scope.cages = [];
        }
      }
      // Defensive: ensure shipping/project/meta exist
      if (!er.shipping) er.shipping = { delivery_required: false, distance_km: 0, truck_capacity_tons: 7 };
      if (!er.project) er.project = { project_name: "Quick Quote", location: "Ontario" };
      if (!er.meta) er.meta = { units: "imperial", currency: "CAD" };

      const body = {
        action: args.action || "quote",
        estimate_request: er,
        company_id: companyId,
      };

      const qeRes = await fetch(`${supabaseUrl}/functions/v1/quote-engine`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": authHeader },
        body: JSON.stringify(body),
      });

      if (qeRes.ok) {
        const qeData = await qeRes.json();
        // ── $0 quote interception: block "successful" quotes with zero total ──
        const grandTotal = qeData?.summary?.grand_total ?? qeData?.grand_total ?? 0;
        const hasLineItems = (er?.scope?.straight_rebar_lines?.length > 0 ||
          er?.scope?.fabricated_rebar_lines?.length > 0 ||
          er?.scope?.cages?.length > 0 ||
          er?.scope?.ties_circular?.length > 0 ||
          er?.scope?.dowels?.length > 0 ||
          er?.scope?.mesh?.length > 0);
        if (grandTotal <= 0 && hasLineItems) {
          console.warn("[generate_sales_quote] $0 quote intercepted despite line items in request");
          result.result = {
            success: false,
            quote_recovery: true,
            pricing_status: "failed",
            failure_reason: "grand_total_zero",
            missing_inputs: qeData?.missing_inputs_questions || [],
            message: "The quote returned $0 despite having line items. This usually means required details are missing (e.g. cage weight, bar size not in pricing). Please ask the customer for the missing information and try again.",
            original_result: qeData,
          };
        } else {
          result.result = { success: true, ...qeData };
        }
      } else {
        const errBody = await qeRes.text();
        let parsedErr: any = {};
        try { parsedErr = JSON.parse(errBody); } catch {}
        console.warn("[generate_sales_quote] Quote engine returned non-200:", qeRes.status, parsedErr?.error || errBody);
        result.result = {
          success: false,
          quote_recovery: true,
          pricing_status: "failed",
          failure_reason: parsedErr?.failure_reason || "engine_error",
          error: parsedErr?.error || errBody,
          missing_inputs: parsedErr?.failure_details?.missing_inputs || parsedErr?.missing_inputs_questions || [],
          message: "The quote engine could not price this request. Check the missing_inputs list and ask the customer to provide the missing details before re-quoting.",
        };
      }
    }

    // ═══════════════════════════════════════════════════
    // 12. Export Estimate
    // ═══════════════════════════════════════════════════
    else if (name === "export_estimate") {
      const projectId = args.project_id;
      if (!projectId) {
        result.result = { error: "project_id is required" };
      } else {
        const { data: project } = await svcClient
          .from("estimation_projects")
          .select("*")
          .eq("id", projectId)
          .maybeSingle();

        const { data: items } = await svcClient
          .from("estimation_items")
          .select("*")
          .eq("project_id", projectId)
          .order("element_type", { ascending: true });

        // Build element summaries
        const elementSummary: Record<string, { count: number; weight: number; cost: number }> = {};
        for (const item of items || []) {
          const key = item.element_type || "other";
          if (!elementSummary[key]) elementSummary[key] = { count: 0, weight: 0, cost: 0 };
          elementSummary[key].count += item.quantity || 0;
          elementSummary[key].weight += item.weight_kg || 0;
          elementSummary[key].cost += item.line_cost || 0;
        }

        result.result = {
          success: true,
          export: {
            project: {
              id: project?.id,
              name: project?.name,
              status: project?.status,
              total_weight_kg: project?.total_weight_kg,
              total_cost: project?.total_cost,
              waste_factor_pct: project?.waste_factor_pct,
              labor_hours: project?.labor_hours,
              created_at: project?.created_at,
            },
            element_summary: elementSummary,
            items: (items || []).map((i: any) => ({
              element_type: i.element_type,
              element_ref: i.element_ref,
              mark: i.mark,
              bar_size: i.bar_size,
              quantity: i.quantity,
              cut_length_mm: i.cut_length_mm,
              total_length_mm: i.total_length_mm,
              weight_kg: i.weight_kg,
              unit_cost: i.unit_cost,
              line_cost: i.line_cost,
              warnings: i.warnings,
            })),
            item_count: items?.length ?? 0,
          },
        };
      }
    }

    // ═══════════════════════════════════════════════════
    // 13. Update Delivery Status
    // ═══════════════════════════════════════════════════
    else if (name === "update_delivery_status") {
      const { data, error } = await svcClient
        .from("deliveries")
        .update({ status: args.status })
        .eq("id", args.id)
        .select();
      result.result = error ? { error: error.message } : { success: true, data };
    }
    
    // ═══════════════════════════════════════════════════
    // QB: Fetch Live Report from QuickBooks
    // ═══════════════════════════════════════════════════
    else if (name === "fetch_qb_report") {
      // Map report_type → correct quickbooks-oauth action name
      const reportTypeToAction: Record<string, string> = {
        ProfitAndLoss:    "get-profit-loss",
        BalanceSheet:     "get-balance-sheet",
        AgedReceivables:  "get-aged-receivables",
        AgedPayables:     "get-aged-payables",
        CashFlow:         "get-cash-flow",
        TaxSummary:       "get-tax-summary",
      };

      // Period → concrete dates helper
      function resolvePeriodDates(period: string): { startDate: string; endDate: string } {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth(); // 0-based
        const pad = (n: number) => String(n).padStart(2, "0");
        const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        switch (period?.toLowerCase()) {
          case "this month":
            return { startDate: `${y}-${pad(m + 1)}-01`, endDate: fmt(new Date(y, m + 1, 0)) };
          case "last month": {
            const lm = m === 0 ? 11 : m - 1;
            const ly = m === 0 ? y - 1 : y;
            return { startDate: `${ly}-${pad(lm + 1)}-01`, endDate: fmt(new Date(ly, lm + 1, 0)) };
          }
          case "this year":
            return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
          case "last year":
            return { startDate: `${y - 1}-01-01`, endDate: `${y - 1}-12-31` };
          case "this quarter": {
            const q = Math.floor(m / 3);
            return { startDate: `${y}-${pad(q * 3 + 1)}-01`, endDate: fmt(new Date(y, q * 3 + 3, 0)) };
          }
          default:
            return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
        }
      }

      const action = reportTypeToAction[args.report_type] ?? "get-profit-loss";
      const reportType = args.report_type as string;

      // Resolve dates — prefer explicit dates, fall back to period string
      let startDate = args.start_date as string | undefined;
      let endDate   = args.end_date   as string | undefined;
      if ((!startDate || !endDate) && args.period) {
        const resolved = resolvePeriodDates(args.period as string);
        startDate = startDate ?? resolved.startDate;
        endDate   = endDate   ?? resolved.endDate;
      }

      // Build camelCase body that each QB handler expects
      let qbBody: Record<string, unknown> = { action, company_id: companyId };
      if (reportType === "BalanceSheet" || reportType === "AgedReceivables" || reportType === "AgedPayables") {
        // These handlers read body.asOfDate (use endDate as the as-of date)
        qbBody.asOfDate = endDate ?? new Date().toISOString().split("T")[0];
      } else {
        // P&L, CashFlow, TaxSummary → startDate / endDate
        if (startDate) qbBody.startDate = startDate;
        if (endDate)   qbBody.endDate   = endDate;
      }

      const reportRes = await fetch(`${supabaseUrl}/functions/v1/quickbooks-oauth`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": authHeader },
        body: JSON.stringify(qbBody),
      });

      if (reportRes.ok) {
        const reportData = await reportRes.json();
        result.result = { success: true, report_type: reportType, data: reportData };
      } else {
        const errText = await reportRes.text();
        result.result = { success: false, error: errText };
      }
    }

    // ═══════════════════════════════════════════════════
    // QB: Fetch GL Anomalies
    // ═══════════════════════════════════════════════════
    else if (name === "fetch_gl_anomalies") {
      const daysBack = args.days_back ?? 30;
      const minAmount = args.min_amount ?? 1000;
      const since = new Date(Date.now() - daysBack * 86400000).toISOString();

      // Large / round-number transactions
      const { data: largeEntries } = await svcClient
        .from("gl_transactions")
        .select("id, txn_date, description, total_debit, total_credit, source_ref, status")
        .eq("company_id", companyId)
        .gte("txn_date", since.split("T")[0])
        .gte("total_debit", minAmount)
        .order("total_debit", { ascending: false })
        .limit(20);

      // Unbalanced transactions (debit != credit)
      const { data: unbalanced } = await svcClient
        .from("gl_transactions")
        .select("id, txn_date, description, total_debit, total_credit, source_ref")
        .eq("company_id", companyId)
        .gte("txn_date", since.split("T")[0])
        .neq("status", "voided")
        .limit(200);

      const imbalanced = (unbalanced || []).filter((t: any) => 
        Math.abs((t.total_debit || 0) - (t.total_credit || 0)) > 0.01
      );

      // Round-number large entries (divisible by 1000)
      const roundNumberFlags = (largeEntries || []).filter((t: any) => 
        (t.total_debit || 0) % 1000 === 0
      );

      result.result = {
        success: true,
        anomalies: {
          large_transactions: largeEntries || [],
          imbalanced_entries: imbalanced.slice(0, 10),
          round_number_flags: roundNumberFlags,
          summary: {
            large_count: (largeEntries || []).length,
            imbalanced_count: imbalanced.length,
            round_number_count: roundNumberFlags.length,
            scan_period_days: daysBack,
            min_amount: minAmount,
          },
        },
      };
    }

    // ═══════════════════════════════════════════════════
    // QB: Trigger Sync
    // ═══════════════════════════════════════════════════
    else if (name === "trigger_qb_sync") {
      const syncRes = await fetch(`${supabaseUrl}/functions/v1/qb-sync-engine`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": authHeader },
        body: JSON.stringify({
          mode: args.mode || "incremental",
          company_id: companyId,
        }),
      });

      if (syncRes.ok) {
        const syncData = await syncRes.json();
        result.result = { success: true, message: "QuickBooks sync triggered", ...syncData };
      } else {
        result.result = { success: false, error: await syncRes.text() };
      }
    }

    // ═══════════════════════════════════════════════════
    // 14. Generate Image (Pixel / Social Agent)
    // ═══════════════════════════════════════════════════
    else if (name === "generate_image") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        result.result = { error: "LOVABLE_API_KEY not configured" };
      } else {
        try {
          let imagePrompt = args.prompt || "A professional rebar construction image";
          const slot = args.slot || "";
          // Hoist aspectRatio to outer scope so ALL paths (OpenAI, Gemini, fallback) can access it
          const aspectRatio: string = (context?.imageAspectRatio as string) || args.aspect_ratio || "1:1";
          console.log(`[generate_image] aspectRatio resolved (hoisted): args=${args.aspect_ratio}, context=${context?.imageAspectRatio}, final=${aspectRatio}`);

          // Inject mandatory style/product overrides from user selections
          // Nuclear enforcement: from context AND from tool args
          if (agent === "social") {
            const IMAGE_STYLE_MAP: Record<string, string> = {
              realism: "Hyper-realistic industrial photography with dramatic natural lighting",
              urban: "Gritty urban construction site with city skyline backdrop",
              cartoon: "Bold cartoon / comic-book illustration style with thick outlines, vibrant flat colors, exaggerated proportions",
              cinematic: "Cinematic wide-angle shot with dramatic depth of field and movie-grade color grading",
              dark: "Dark moody atmosphere with high contrast shadows and dramatic rim lighting",
              golden: "Warm golden-hour lighting with lens flare and rich amber tones",
              minimal: "Clean minimalist composition with negative space and simple geometry",
              animation: "3D Pixar-style animated render with vibrant colors, smooth surfaces, stylized realism",
              painting: "Oil painting style with visible brush strokes, rich texture, classical fine art aesthetic",
              ai_modern: "Futuristic AI-generated aesthetic with neon accents and digital glitch elements",
            };
            const PRODUCT_PROMPT_MAP: Record<string, string> = {
              fiberglass_straight: "Fiberglass straight rebar bars — translucent composite material, lighter than steel",
              stirrups: "Steel rebar stirrups — rectangular/square bent shapes used for column and beam reinforcement",
              cages: "Assembled rebar cages — cylindrical or rectangular tied reinforcement structures",
              hooks: "Rebar hooks — steel bars with 90° or 180° bends at the ends",
              dowels: "Steel dowel bars — short straight smooth bars used for slab connections",
              wire_mesh: "Welded wire mesh / steel fabric — grid pattern of welded steel wires for slab reinforcement",
              rebar_straight: "Straight steel rebar bars — standard deformed reinforcing steel bars",
            };
            const NON_REALISTIC = ["cartoon", "animation", "painting", "ai_modern"];

            // Collect styles from both context and tool args
            const uStyles = (context?.imageStyles as string[]) || [];
            const uProducts = (context?.selectedProducts as string[]) || [];
            if (args.style && !uStyles.includes(args.style)) uStyles.push(args.style);
            if (args.products) {
              const toolProds = args.products.split(",").map((p: string) => p.trim());
              toolProds.forEach((p: string) => { if (!uProducts.includes(p)) uProducts.push(p); });
            }

            if (uStyles.length || uProducts.length) {
              const isNonRealistic = uStyles.some((s: string) => NON_REALISTIC.includes(s));
              let mandatoryBlock = "=== MANDATORY REQUIREMENTS (DO NOT IGNORE) ===\n";
              if (uStyles.length) {
                const desc = uStyles.map((k: string) => IMAGE_STYLE_MAP[k] || k).join(". ");
                mandatoryBlock += `VISUAL STYLE: ${desc}.\n`;
                if (isNonRealistic) {
                  mandatoryBlock += `CRITICAL: This is NON-PHOTOREALISTIC. Do NOT make it look like a real photograph.\n`;
                  // Strip conflicting photorealistic terms from LLM prompt
                  const REALISTIC_TERMS = ["photorealistic", "hyper-realistic", "realistic photography", "professional photography", "real photo", "documentary photography", "photo taken with"];
                  for (const term of REALISTIC_TERMS) {
                    imagePrompt = imagePrompt.replace(new RegExp(term, "gi"), "");
                  }
                }
              }

              // NUCLEAR PRODUCT OVERRIDE: strip ALL product names, then inject only the selected ones
              if (uProducts.length) {
                const selectedDesc = uProducts.map((k: string) => PRODUCT_PROMPT_MAP[k] || k).join("; ");
                mandatoryBlock += `PRIMARY SUBJECT: ${selectedDesc}. The product MUST be the central focus of the image.\n`;

                // Comprehensive list of ALL product names/variants to strip
                const ALL_PRODUCT_NAMES = [
                  "rebar stirrup", "rebar stirrups", "steel stirrup", "steel stirrups", "rectangular stirrup", "square stirrup",
                  "rebar cage", "rebar cages", "assembled cage", "cylindrical cage", "reinforcement cage", "tied cage",
                  "rebar hook", "rebar hooks", "steel hook", "steel hooks", "bent hook",
                  "dowel bar", "dowel bars", "steel dowel", "smooth bar", "slab connection",
                  "wire mesh", "welded mesh", "steel fabric", "welded wire", "mesh panel",
                  "fiberglass rebar", "fiberglass bar", "fiberglass straight", "gfrp", "composite rebar",
                  "rebar straight", "straight rebar", "deformed bar", "reinforcing bar", "reinforcing steel",
                  "stirrup", "stirrups", "cage", "cages", "hook", "hooks", "dowel", "dowels",
                ];
                for (const term of ALL_PRODUCT_NAMES) {
                  imagePrompt = imagePrompt.replace(new RegExp(`\\b${term}s?\\b`, "gi"), "");
                }
                // Clean up leftover whitespace from removals
                imagePrompt = imagePrompt.replace(/\s{2,}/g, " ").trim();
              }
              mandatoryBlock += "=== END MANDATORY REQUIREMENTS ===\n\n";

              imagePrompt = mandatoryBlock + imagePrompt;
            }

            // Inject aspect ratio as soft composition guidance (final dimensions enforced by server-side crop)
            // aspectRatio already declared at top of generate_image handler
            const AR_COMPOSITION_MAP: Record<string, string> = {
              "16:9": "CRITICAL ASPECT RATIO: Generate this image in LANDSCAPE orientation (wider than tall). Target dimensions: 1536×864 pixels. The image MUST be significantly wider than it is tall. Spread important elements horizontally.",
              "9:16": "CRITICAL ASPECT RATIO: Generate this image in PORTRAIT orientation (taller than wide). Target dimensions: 864×1536 pixels. The image MUST be significantly taller than it is wide. Arrange elements vertically (suitable for Stories/Reels).",
              "1:1": "CRITICAL ASPECT RATIO: Generate this image as a perfect SQUARE. Target dimensions: 1024×1024 pixels. The image width and height must be equal. Center the main subject.",
            };
            imagePrompt += `\n\n${AR_COMPOSITION_MAP[aspectRatio] || `Compose the image for a ${aspectRatio} layout.`}`;
            imagePrompt += "\n\nLANGUAGE RULE: ALL text rendered on the image MUST be in ENGLISH ONLY. NO Persian, Farsi, Arabic, or any non-Latin script text is allowed in the image.";

            // Fetch Brain resource images for multimodal reference
            try {
              const { data: brainImages } = await svcClient
                .from("knowledge")
                .select("source_url, title")
                .eq("company_id", companyId)
                .eq("category", "image")
                .not("title", "ilike", "%logo%")
                .not("title", "ilike", "%favicon%")
                .order("created_at", { ascending: false })
                .limit(3);

              if (brainImages?.length) {
                const validUrls: string[] = [];
                for (const row of brainImages) {
                  if (!row.source_url) continue;
                  let url = row.source_url;
                  if (url.includes("estimation-files/")) {
                    const path = url.split("/estimation-files/").pop()?.split("?")[0];
                    if (path) {
                      const { data: signed } = await svcClient.storage.from("estimation-files").createSignedUrl(path, 600);
                      if (signed?.signedUrl) url = signed.signedUrl;
                      else continue;
                    }
                  }
                  try {
                    const check = await fetch(url, { method: "HEAD" });
                    if (check.ok) validUrls.push(url);
                  } catch { /* skip */ }
                }
                if (validUrls.length) {
                  (context as any).__brainImageUrls = validUrls;
                }
              }
            } catch (_) { /* non-fatal */ }
          }

          // Resolve logo for social agent (broader search: logo OR favicon)
          let logoUrl: string | undefined;
          if (agent === "social") {
            try {
              const { data: logoRows } = await svcClient
                .from("knowledge")
                .select("source_url, title")
                .eq("company_id", companyId)
                .or("title.ilike.%logo%,title.ilike.%favicon%")
                .eq("category", "image")
                .order("created_at", { ascending: false })
                .limit(5);

              for (const row of logoRows || []) {
                if (!row.source_url) continue;
                const rawUrl = row.source_url;
                let candidateUrl: string | undefined;
                if (rawUrl.includes("estimation-files/")) {
                  const storagePath = rawUrl.split("/estimation-files/").pop()?.split("?")[0];
                  if (storagePath) {
                    const { data: signedData } = await svcClient.storage
                      .from("estimation-files")
                      .createSignedUrl(storagePath, 600);
                    candidateUrl = signedData?.signedUrl || undefined;
                  }
                } else {
                  candidateUrl = rawUrl;
                }
                if (candidateUrl) {
                  try {
                    const check = await fetch(candidateUrl, { method: "HEAD" });
                    if (check.ok) { logoUrl = candidateUrl; break; }
                  } catch { /* try next */ }
                }
              }
            } catch (_) { /* non-fatal */ }
          }

          const fullPrompt = imagePrompt +
            "\n\nIMPORTANT: Place the text 'REBAR.SHOP' prominently as a watermark/logo in the image.";

          let generated = false;
          let lastError = "Unknown";

          // --- OpenAI gpt-image-1 path when user selected ChatGPT ---
          const userPreferredModel = (context as any)?.preferredModel;
          if (userPreferredModel === "chatgpt") {
            const GPT_API_KEY = Deno.env.get("GPT_API_KEY");
            if (GPT_API_KEY) {
              try {
                console.log("[generate_image] Attempting OpenAI gpt-image-1 (user selected ChatGPT)...");
                const openaiSizeMap: Record<string, string> = { "1:1": "1024x1024", "16:9": "1536x1024", "9:16": "1024x1536" };
                const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${GPT_API_KEY}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: "gpt-image-1",
                    prompt: fullPrompt,
                    n: 1,
                    size: openaiSizeMap[aspectRatio] || "1024x1024",
                    quality: "high",
                  }),
                });

                if (openaiRes.ok) {
                  const openaiData = await openaiRes.json();
                  const imgItem = openaiData.data?.[0];
                  let imageBytes: Uint8Array | null = null;
                  if (imgItem?.b64_json) {
                    imageBytes = Uint8Array.from(atob(imgItem.b64_json), (c) => c.charCodeAt(0));
                  } else if (imgItem?.url) {
                    const dlRes = await fetch(imgItem.url);
                    if (dlRes.ok) imageBytes = new Uint8Array(await dlRes.arrayBuffer());
                  }
                  if (imageBytes) {
                    try { if (aspectRatio) imageBytes = await cropToAspectRatio(imageBytes, aspectRatio); } catch (cropErr) { console.warn("[generate_image] OpenAI crop failed, using original:", cropErr); }
                    const imagePath = `pixel/${slot ? slot.replace(":", "") + "/" : ""}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
                    const { error: uploadError } = await svcClient.storage
                      .from("social-images")
                      .upload(imagePath, imageBytes, { contentType: "image/png" });
                    if (!uploadError) {
                      const { data: urlData } = svcClient.storage.from("social-images").getPublicUrl(imagePath);
                      console.log(`[generate_image] ✓ OpenAI gpt-image-1 uploaded: ${urlData.publicUrl}`);
                      result.result = { success: true, image_url: urlData.publicUrl, slot, message: `Image generated via OpenAI for slot ${slot}` };
                      generated = true;
                    }
                  }
                } else {
                  console.warn(`[generate_image] OpenAI gpt-image-1 returned ${openaiRes.status}, falling back to Gemini`);
                }
              } catch (e: any) {
                console.warn(`[generate_image] OpenAI error: ${e?.message || e}, falling back to Gemini`);
              }
            }
          }

          // Retry pipeline: try multiple models (2 primary + 2 fallback max = 4 total)
          const attempts = [
            { model: "google/gemini-3.1-flash-image-preview", useLogo: true },
            { model: "google/gemini-3-pro-image-preview", useLogo: true },
          ];

          if (!generated) for (const attempt of attempts) {
            const contentParts: any[] = [{ type: "text", text: fullPrompt }];
            if (attempt.useLogo && logoUrl) {
              contentParts.push({ type: "image_url", image_url: { url: logoUrl } });
              contentParts.push({ type: "text", text: "Incorporate the provided company logo as a branded watermark." });
            }
            // Attach Brain resource images as visual references
            const brainUrls = (context as any)?.__brainImageUrls as string[] | undefined;
            if (brainUrls?.length) {
              contentParts.push({ type: "text", text: "Use the following product reference images to match the real appearance of the products:" });
              for (const bUrl of brainUrls) {
                contentParts.push({ type: "image_url", image_url: { url: bUrl } });
              }
            }

            const imgController = new AbortController();
            const imgTimeout = setTimeout(() => imgController.abort(), 60000);
            let aiRes: Response;
            try {
              aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                signal: imgController.signal,
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: attempt.model,
                  messages: [{ role: "user", content: contentParts }],
                  modalities: ["image", "text"],
                  ...(aspectRatio && aspectRatio !== "1:1" ? { image_generation_config: { aspectRatio } } : {}),
                }),
              });
            } catch (fetchErr: any) {
              const isTimeout = fetchErr?.name === "AbortError";
              console.warn(`[generate_image] ${attempt.model} ${isTimeout ? "TIMEOUT (60s)" : "FETCH ERROR"}: ${fetchErr?.message || fetchErr}`);
              lastError = `${attempt.model}: ${isTimeout ? "timeout" : fetchErr?.message}`;
              continue;
            } finally {
              clearTimeout(imgTimeout);
            }

            if (!aiRes.ok) { const errBody = await aiRes.text().catch(() => ""); console.warn(`[generate_image] ${attempt.model} returned ${aiRes.status}: ${errBody.slice(0, 200)}`); lastError = `${attempt.model}: ${aiRes.status}`; continue; }

            const aiData = await aiRes.json();

            // Robust image extraction (multiple formats)
            const msg = aiData?.choices?.[0]?.message;
            let imageDataUrl: string | null = null;
            // Format 1: images[]
            imageDataUrl = msg?.images?.[0]?.image_url?.url || null;
            // Format 2: parts[].inline_data
            if (!imageDataUrl && Array.isArray(msg?.parts)) {
              for (const part of msg.parts) {
                if (part.inline_data?.data) {
                  imageDataUrl = `data:${part.inline_data.mime_type || "image/png"};base64,${part.inline_data.data}`;
                  break;
                }
              }
            }
            // Format 3: content[].image_url
            if (!imageDataUrl && Array.isArray(msg?.content)) {
              for (const block of msg.content) {
                if (block.type === "image_url" && block.image_url?.url) { imageDataUrl = block.image_url.url; break; }
              }
            }

            if (!imageDataUrl) { lastError = `${attempt.model}: no parseable image`; continue; }

            // Upload
            let imageBytes: Uint8Array;
            if (imageDataUrl.startsWith("data:")) {
              const b64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
              imageBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            } else {
              const dl = await fetch(imageDataUrl);
              if (!dl.ok) { lastError = "Failed to download image"; continue; }
              imageBytes = new Uint8Array(await dl.arrayBuffer());
            }

            // Enforce aspect ratio via server-side crop/resize
            try {
              if (aspectRatio) { imageBytes = await cropToAspectRatio(imageBytes, aspectRatio); }
            } catch (cropErr) { console.warn("[generate_image] Gemini crop failed, using original:", cropErr); }

            const imagePath = `pixel/${slot ? slot.replace(":", "") + "/" : ""}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
            const { error: uploadError } = await svcClient.storage
              .from("social-images")
              .upload(imagePath, imageBytes, { contentType: "image/png" });

            if (uploadError) { lastError = `Upload: ${uploadError.message}`; continue; }

            const { data: urlData } = svcClient.storage.from("social-images").getPublicUrl(imagePath);
            result.result = {
              success: true,
              image_url: urlData.publicUrl,
              slot,
              message: `Image generated and uploaded successfully for slot ${slot}`,
            };
            generated = true;
            break;
          }

          // Fallback: if all attempts failed and ratio is not 1:1, retry with square ratio (max 2 attempts)
          if (!generated && aspectRatio && aspectRatio !== "1:1") {
            console.log(`[generate_image] All attempts failed with ratio ${aspectRatio}, retrying with 1:1 fallback...`);
            const fallbackAttempts = attempts.slice(0, 2);
            for (const attempt of fallbackAttempts) {
              const contentParts: any[] = [{ type: "text", text: fullPrompt }];
              if (attempt.useLogo && logoUrl) {
                contentParts.push({ type: "image_url", image_url: { url: logoUrl } });
                contentParts.push({ type: "text", text: "Incorporate the provided company logo as a branded watermark." });
              }
              const brainUrls = (context as any)?.__brainImageUrls as string[] | undefined;
              if (brainUrls?.length) {
                contentParts.push({ type: "text", text: "Use the following product reference images to match the real appearance of the products:" });
                for (const bUrl of brainUrls) {
                  contentParts.push({ type: "image_url", image_url: { url: bUrl } });
                }
              }

              const fbController = new AbortController();
              const fbTimeout = setTimeout(() => fbController.abort(), 60000);
              let aiRes: Response;
              try {
                aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  signal: fbController.signal,
                  headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: attempt.model,
                    messages: [{ role: "user", content: contentParts }],
                    modalities: ["image", "text"],
                  }),
                });
              } catch (fetchErr: any) {
                const isTimeout = fetchErr?.name === "AbortError";
                console.warn(`[generate_image] ${attempt.model} (1:1 fallback) ${isTimeout ? "TIMEOUT (60s)" : "FETCH ERROR"}: ${fetchErr?.message || fetchErr}`);
                lastError = `${attempt.model} (1:1 fallback): ${isTimeout ? "timeout" : fetchErr?.message}`;
                continue;
              } finally {
                clearTimeout(fbTimeout);
              }

              if (!aiRes.ok) { lastError = `${attempt.model} (1:1 fallback): ${aiRes.status}`; continue; }

              const aiData = await aiRes.json();
              const msg = aiData?.choices?.[0]?.message;
              let imageDataUrl: string | null = null;
              imageDataUrl = msg?.images?.[0]?.image_url?.url || null;
              if (!imageDataUrl && Array.isArray(msg?.parts)) {
                for (const part of msg.parts) {
                  if (part.inline_data?.data) {
                    imageDataUrl = `data:${part.inline_data.mime_type || "image/png"};base64,${part.inline_data.data}`;
                    break;
                  }
                }
              }
              if (!imageDataUrl && Array.isArray(msg?.content)) {
                for (const block of msg.content) {
                  if (block.type === "image_url" && block.image_url?.url) { imageDataUrl = block.image_url.url; break; }
                }
              }

              if (!imageDataUrl) { lastError = `${attempt.model} (1:1 fallback): no parseable image`; continue; }

              let imageBytes: Uint8Array;
              if (imageDataUrl.startsWith("data:")) {
                const b64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
                imageBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
              } else {
                const dl = await fetch(imageDataUrl);
                if (!dl.ok) { lastError = "Failed to download image (1:1 fallback)"; continue; }
                imageBytes = new Uint8Array(await dl.arrayBuffer());
              }

              // Apply original aspect ratio crop even on 1:1 fallback generation
              if (aspectRatio && aspectRatio !== "1:1") {
                imageBytes = await cropToAspectRatio(imageBytes, aspectRatio);
                console.log(`[generate_image] Applied ${aspectRatio} crop to 1:1 fallback image`);
              }

              const imagePath = `pixel/${slot ? slot.replace(":", "") + "/" : ""}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
              const { error: uploadError } = await svcClient.storage
                .from("social-images")
                .upload(imagePath, imageBytes, { contentType: "image/png" });

              if (uploadError) { lastError = `Upload (1:1 fallback): ${uploadError.message}`; continue; }

              const { data: urlData } = svcClient.storage.from("social-images").getPublicUrl(imagePath);
              result.result = {
                success: true,
                image_url: urlData.publicUrl,
                slot,
                message: `Image generated with square fallback for slot ${slot}`,
              };
              generated = true;
              break;
            }
          }

          if (!generated) {
            result.result = { error: `All attempts failed. Last: ${lastError}` };
          }
        } catch (imgErr) {
          result.result = { error: `Image generation error: ${imgErr instanceof Error ? imgErr.message : String(imgErr)}` };
        }
      }
    }

    // ═══════════════════════════════════════════════════
    // 15. Generate Video (Pixel / Social Agent)
    // ═══════════════════════════════════════════════════
    else if (name === "generate_video") {
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) {
        result.result = { error: "GEMINI_API_KEY not configured for video generation" };
      } else {
        try {
          const videoPrompt = args.prompt || "A professional rebar construction video";
          const duration = Math.min(Math.max(args.duration || 8, 5), 15);
          const slot = args.slot || "";

          // Step 1: Submit generation via generate-video edge function
          const genRes = await fetch(`${supabaseUrl}/functions/v1/generate-video`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": authHeader },
            body: JSON.stringify({
              action: "generate",
              provider: "veo",
              prompt: videoPrompt,
              duration,
            }),
          });

          if (!genRes.ok) {
            const errText = await genRes.text();
            result.result = { error: `Video generation failed: ${errText}` };
          } else {
            const genData = await genRes.json();
            const jobId = genData.jobId;

            if (!jobId) {
              result.result = { error: "No job ID returned from video generation" };
            } else {
              // Step 2: Poll until completed (max ~4 minutes)
              let videoUrl: string | null = null;
              let pollError: string | null = null;
              const maxPolls = 48; // 48 * 5s = 240s = 4 min
              
              for (let i = 0; i < maxPolls; i++) {
                await new Promise(r => setTimeout(r, 5000)); // wait 5s

                const pollRes = await fetch(`${supabaseUrl}/functions/v1/generate-video`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": authHeader },
                  body: JSON.stringify({
                    action: "poll",
                    provider: "veo",
                    jobId,
                  }),
                });

                if (!pollRes.ok) {
                  pollError = `Poll failed: ${pollRes.status}`;
                  break;
                }

                const pollData = await pollRes.json();

                if (pollData.status === "completed") {
                  videoUrl = pollData.videoUrl;
                  break;
                } else if (pollData.status === "failed") {
                  pollError = pollData.error || "Video generation failed";
                  break;
                }
                // else "processing" → continue polling
              }

              if (videoUrl) {
                // Step 3: Download and upload to storage
                try {
                  const videoRes = await fetch(videoUrl);
                  if (!videoRes.ok) throw new Error(`Download failed: ${videoRes.status}`);
                  const videoBytes = new Uint8Array(await videoRes.arrayBuffer());

                  const videoPath = `pixel-videos/${slot ? slot.replace(":", "") + "/" : ""}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
                  const { error: uploadError } = await svcClient.storage
                    .from("social-media-assets")
                    .upload(videoPath, videoBytes, { contentType: "video/mp4" });

                  if (uploadError) {
                    // Fallback: return the direct URL
                    result.result = {
                      success: true,
                      video_url: videoUrl,
                      slot,
                      message: `Video generated (upload failed: ${uploadError.message}). Direct URL provided.`,
                    };
                  } else {
                    const { data: urlData } = svcClient.storage.from("social-media-assets").getPublicUrl(videoPath);
                    result.result = {
                      success: true,
                      video_url: urlData.publicUrl,
                      slot,
                      message: `Video generated and uploaded successfully${slot ? ` for slot ${slot}` : ""}`,
                    };
                  }
                } catch (dlErr) {
                  // Return direct URL as fallback
                  result.result = {
                    success: true,
                    video_url: videoUrl,
                    slot,
                    message: `Video generated. Direct URL provided (storage upload skipped).`,
                  };
                }
              } else if (pollError) {
                result.result = { error: pollError };
              } else {
                result.result = { error: "Video generation timed out after 4 minutes" };
              }
            }
          }
        } catch (vidErr) {
          result.result = { error: `Video generation error: ${vidErr instanceof Error ? vidErr.message : String(vidErr)}` };
        }
      }
    }

    // ── Empire Tools ──────────────────────────────────────────────
    else if (toolName === "resolve_task") {
      const { task_id, resolution_note, new_status } = args;
      if (!task_id) { result.result = { error: "task_id is required" }; }
      else {
        const { error } = await serviceClient.from("autopilot_runs")
          .update({ status: new_status || "resolved", approval_note: resolution_note, completed_at: new Date().toISOString() })
          .eq("id", task_id)
          .eq("company_id", companyId);
        result.result = error ? { error: error.message } : { success: true, message: `Task ${task_id} resolved.` };
      }
    }

    else if (toolName === "read_task") {
      const { task_id } = args;
      if (!task_id) { result.result = { error: "task_id is required" }; }
      else {
        const { data, error } = await serviceClient.from("autopilot_runs")
          .select("*")
          .eq("id", task_id)
          .eq("company_id", companyId)
          .maybeSingle();
        result.result = error ? { error: error.message } : { success: true, task: data };
      }
    }

    else if (toolName === "generate_patch") {
      const { file_path, patch_content, description, patch_type, target_system } = args;
      if (!file_path || !patch_content) { result.result = { error: "file_path and patch_content are required" }; }
      else {
        const { data, error } = await serviceClient.from("code_patches").insert({
          company_id: companyId,
          created_by: userId,
          file_path,
          patch_content,
          description: description || "",
          patch_type: patch_type || "fix",
          target_system: target_system || "lovable",
          status: "pending",
        }).select("id").single();
        result.result = error ? { error: error.message } : { success: true, patch_id: data?.id, message: "Patch created for review." };
      }
    }

    else if (toolName === "validate_code") {
      const { patch_content } = args;
      if (!patch_content || !patch_content.trim()) {
        result.result = { valid: false, errors: ["Patch content is empty."] };
      } else {
        const errors: string[] = [];
        const dangerous = ["DROP TABLE", "DROP SCHEMA", "TRUNCATE", "DELETE FROM auth.", "ALTER SYSTEM", "pg_terminate"];
        for (const p of dangerous) {
          if (patch_content.toUpperCase().includes(p)) errors.push(`Dangerous pattern detected: ${p}`);
        }
        if (patch_content.length > 50000) errors.push("Patch exceeds 50k character limit.");
        result.result = { valid: errors.length === 0, errors };
      }
    }

    else if (toolName === "create_fix_ticket") {
      const { system_area, repro_steps, expected_result, actual_result, severity, page_url, screenshot_url } = args;
      if (!system_area || !repro_steps) { result.result = { error: "system_area and repro_steps are required" }; }
      else {
        const { data, error } = await serviceClient.from("fix_tickets").insert({
          company_id: companyId,
          reporter_user_id: userId,
          system_area,
          repro_steps,
          expected_result: expected_result || null,
          actual_result: actual_result || null,
          severity: severity || "medium",
          status: "open",
          page_url: page_url || null,
          screenshot_url: screenshot_url || null,
        }).select("id").single();
        result.result = error ? { error: error.message } : { success: true, ticket_id: data?.id, message: "Fix ticket created." };
      }
    }

    else if (toolName === "update_fix_ticket") {
      const { ticket_id, status, fix_output, fix_output_type } = args;
      if (!ticket_id) { result.result = { error: "ticket_id is required" }; }
      else {
        const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
        if (fix_output) updates.fix_output = fix_output;
        if (fix_output_type) updates.fix_output_type = fix_output_type;
        if (status === "diagnosed") updates.diagnosed_at = new Date().toISOString();
        if (status === "fixed") updates.fixed_at = new Date().toISOString();
        if (status === "verified") updates.verified_at = new Date().toISOString();
        const { error } = await serviceClient.from("fix_tickets")
          .update(updates)
          .eq("id", ticket_id)
          .eq("company_id", companyId);
        result.result = error ? { error: error.message } : { success: true, message: `Ticket ${ticket_id} updated to ${status}.` };
      }
    }

    else if (toolName === "list_fix_tickets") {
      const statusFilter = args.status_filter || "open";
      const limit = args.limit || 20;
      const { data, error } = await serviceClient.from("fix_tickets")
        .select("id, system_area, severity, status, created_at, page_url, repro_steps")
        .eq("company_id", companyId)
        .eq("status", statusFilter)
        .order("created_at", { ascending: false })
        .limit(limit);
      result.result = error ? { error: error.message } : { success: true, tickets: data, count: data?.length || 0 };
    }

    // ═══════════════════════════════════════════════════
    // WordPress / WooCommerce tools (Empire agent)
    // ═══════════════════════════════════════════════════
    else if (toolName === "wp_list_posts" || toolName === "wp_list_pages" || toolName === "wp_list_products" || toolName === "wp_list_orders") {
      try {
        const { WPClient } = await import("../functions/_shared/wpClient.ts").catch(() => import("../_shared/wpClient.ts"));
        const wp = new WPClient();
        const params: Record<string, string> = {};
        if (args.per_page) params.per_page = args.per_page;
        if (args.status) params.status = args.status;
        let data;
        if (toolName === "wp_list_posts") data = await wp.listPosts(params);
        else if (toolName === "wp_list_pages") data = await wp.listPages(params);
        else if (toolName === "wp_list_products") data = await wp.listProducts(params);
        else data = await wp.listOrders(params);
        // Trim to essential fields to save tokens
        const trimmed = (data || []).map((item: any) => ({
          id: item.id,
          title: item.title?.rendered || item.name || item.title,
          status: item.status,
          slug: item.slug,
          link: item.link || item.permalink,
          ...(item.price ? { price: item.price } : {}),
          ...(item.stock_status ? { stock_status: item.stock_status } : {}),
          ...(item.total ? { total: item.total } : {}),
        }));
        result.result = { success: true, count: trimmed.length, items: trimmed };
      } catch (wpErr: any) {
        result.result = { error: `WordPress API error: ${wpErr.message}` };
      }
    }

    else if (toolName === "wp_update_post" || toolName === "wp_update_page" || toolName === "wp_update_product") {
      try {
        const { WPClient } = await import("../functions/_shared/wpClient.ts").catch(() => import("../_shared/wpClient.ts"));
        const wp = new WPClient();
        const id = args.id;
        const updateData = args.data || {};
        let updated;
        if (toolName === "wp_update_post") updated = await wp.updatePost(id, updateData);
        else if (toolName === "wp_update_page") updated = await wp.updatePage(id, updateData);
        else updated = await wp.updateProduct(id, updateData);
        result.result = { success: true, id: updated?.id, title: updated?.title?.rendered || updated?.name };
      } catch (wpErr: any) {
        result.result = { error: `WordPress update error: ${wpErr.message}` };
      }
    }

    else if (toolName === "scrape_page") {
      try {
        const targetUrl = args.url;
        if (!targetUrl) throw new Error("url is required");
        const resp = await fetch(targetUrl, {
          headers: { "User-Agent": "RebarShopOS-Architect/1.0" },
          signal: AbortSignal.timeout(15000),
        });
        const html = await resp.text();
        // Return trimmed HTML (first 8000 chars to avoid token bloat)
        result.result = {
          success: true,
          status_code: resp.status,
          content_length: html.length,
          content: html.slice(0, 8000),
        };
      } catch (scrapeErr: any) {
        result.result = { error: `Scrape error: ${scrapeErr.message}` };
      }
    }

    // ─── Purchasing tools ───
    else if (name === "purchasing_add_item") {
      const { error } = await svcClient.from("purchasing_list_items").insert({
        company_id: companyId,
        title: args.title,
        quantity: args.quantity || 1,
        category: args.category || null,
        priority: args.priority || "medium",
        due_date: args.due_date || null,
        created_by: user.id,
      });
      result.result = error ? { error: error.message } : { success: true, message: `Added "${args.title}" to purchasing list` };
    }
    else if (name === "purchasing_list_items") {
      let query = svcClient.from("purchasing_list_items").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(50);
      if (args.status === "pending") query = query.eq("is_purchased", false);
      else if (args.status === "purchased") query = query.eq("is_purchased", true);
      if (args.due_date) query = query.eq("due_date", args.due_date);
      const { data, error } = await query;
      result.result = error ? { error: error.message } : { items: data, count: data?.length || 0 };
    }
    else if (name === "purchasing_toggle_item") {
      const { error } = await svcClient.from("purchasing_list_items").update({
        is_purchased: args.is_purchased,
        purchased_by: args.is_purchased ? user.id : null,
        purchased_at: args.is_purchased ? new Date().toISOString() : null,
      }).eq("id", args.item_id).eq("company_id", companyId);
      result.result = error ? { error: error.message } : { success: true, message: `Item ${args.is_purchased ? "marked as purchased" : "unmarked"}` };
    }
    else if (name === "purchasing_delete_item") {
      const { error } = await svcClient.from("purchasing_list_items").delete().eq("id", args.item_id).eq("company_id", companyId);
      result.result = error ? { error: error.message } : { success: true, message: "Item deleted" };
    }

    // ═══════════════════════════════════════════════════
    // Save Sales Quotation
    // ═══════════════════════════════════════════════════
    else if (name === "save_sales_quotation") {
      // Generate quotation number Q{YYYY}{NNNN}
      const year = new Date().getFullYear();
      const prefix = `Q${year}`;
      const { data: lastQ } = await svcClient
        .from("sales_quotations")
        .select("quotation_number")
        .eq("company_id", companyId)
        .like("quotation_number", `${prefix}%`)
        .order("quotation_number", { ascending: false })
        .limit(1);

      const lastNum = lastQ?.length ? parseInt(lastQ[0].quotation_number.slice(prefix.length), 10) || 0 : 0;
      const quotationNumber = `${prefix}${String(lastNum + 1).padStart(4, "0")}`;

      // Default expiry: 30 days from now
      const expiryDate = args.expiry_date || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

      // Build notes with line items detail
      let notesText = args.notes || "";
      if (args.line_items?.length) {
        notesText += "\n\n--- Line Items ---\n";
        for (const li of args.line_items) {
          notesText += `• ${li.description}: ${li.quantity} ${li.unit || "pcs"} × $${li.unit_price?.toFixed(2) || "0.00"} = $${li.total?.toFixed(2) || "0.00"}\n`;
        }
      }

      const { data: newQuote, error: qErr } = await svcClient
        .from("sales_quotations")
        .insert({
          company_id: companyId,
          quotation_number: quotationNumber,
          customer_name: args.customer_name || null,
          customer_company: args.customer_company || null,
          sales_lead_id: args.lead_id || null,
          status: "draft",
          amount: args.amount,
          notes: notesText,
          expiry_date: expiryDate,
        })
        .select()
        .single();

      if (qErr) {
        result.result = { error: qErr.message };
      } else {
        result.result = {
          success: true,
          quotation_id: newQuote.id,
          quotation_number: quotationNumber,
          amount: args.amount,
          expiry_date: expiryDate,
          message: `Quotation ${quotationNumber} saved ($${args.amount?.toFixed(2)} CAD, valid until ${expiryDate})`,
        };
      }
    }

    // ═══════════════════════════════════════════════════
    // Send Quotation Email
    // ═══════════════════════════════════════════════════
    else if (name === "send_quotation_email") {
      const quotationId = args.quotation_id;
      const toEmail = args.to_email;
      const customerName = args.customer_name || "Valued Customer";

      // Fetch quotation
      const { data: quote, error: fetchErr } = await svcClient
        .from("sales_quotations")
        .select("*")
        .eq("id", quotationId)
        .single();

      if (fetchErr || !quote) {
        result.result = { error: fetchErr?.message || "Quotation not found" };
      } else {
        // Build professional HTML email
        const senderName = context?.currentUser?.name || "Sales Team";
        const senderEmail = context?.currentUser?.email || "sales@rebar.shop";
        const subject = args.subject || `Quotation ${quote.quotation_number} — REBAR.SHOP`;

        const lineItemsHtml = quote.notes?.includes("--- Line Items ---")
          ? quote.notes.split("--- Line Items ---")[1]
              .trim()
              .split("\n")
              .filter((l: string) => l.startsWith("•"))
              .map((l: string) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${l.replace("• ", "")}</td></tr>`)
              .join("")
          : "";

        const htmlBody = `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;">
  <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px;text-align:center;">
    <h1 style="color:#e94560;font-size:28px;margin:0;letter-spacing:2px;">REBAR.SHOP</h1>
    <p style="color:#a8b2d1;font-size:13px;margin:6px 0 0;">Premium Steel Reinforcement — Ontario, Canada</p>
  </div>
  <div style="padding:32px;">
    <p style="font-size:16px;color:#333;">Dear ${customerName},</p>
    <p style="font-size:15px;color:#555;line-height:1.6;">Thank you for your inquiry. Please find below our quotation for your review.</p>
    
    <div style="background:#f8f9fc;border-radius:8px;padding:20px;margin:24px 0;border-left:4px solid #e94560;">
      <table style="width:100%;">
        <tr><td style="color:#888;font-size:13px;">Quotation #</td><td style="text-align:right;font-weight:600;color:#1a1a2e;">${quote.quotation_number}</td></tr>
        <tr><td style="color:#888;font-size:13px;">Amount</td><td style="text-align:right;font-weight:700;color:#e94560;font-size:20px;">$${(quote.amount || 0).toLocaleString("en-CA", { minimumFractionDigits: 2 })} CAD</td></tr>
        <tr><td style="color:#888;font-size:13px;">Valid Until</td><td style="text-align:right;color:#1a1a2e;">${quote.expiry_date || "30 days"}</td></tr>
      </table>
    </div>

    ${lineItemsHtml ? `
    <h3 style="color:#1a1a2e;font-size:16px;margin:24px 0 12px;">Quotation Details</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr><th style="text-align:left;padding:8px 12px;background:#f1f3f9;color:#555;border-bottom:2px solid #e5e7eb;">Item</th></tr></thead>
      <tbody>${lineItemsHtml}</tbody>
    </table>` : ""}

    <p style="font-size:14px;color:#555;line-height:1.6;margin-top:24px;">
      This quotation is valid for 30 days from the date of issue. Prices are in Canadian Dollars (CAD) and do not include applicable taxes (13% HST).
    </p>
    <p style="font-size:14px;color:#555;">Please feel free to reach out if you have any questions or would like to proceed with this order.</p>
    
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-weight:600;color:#1a1a2e;">${senderName}</p>
      <p style="margin:2px 0;color:#e94560;font-size:13px;">Sales Representative</p>
      <p style="margin:2px 0;color:#888;font-size:13px;">REBAR.SHOP — Premium Steel Reinforcement</p>
      <p style="margin:2px 0;color:#888;font-size:13px;">📞 (905) 761-1311 &nbsp;|&nbsp; ✉️ ${senderEmail}</p>
      <p style="margin:2px 0;color:#888;font-size:13px;">🌐 www.rebar.shop &nbsp;|&nbsp; 📍 Vaughan, Ontario</p>
    </div>
  </div>
  <div style="background:#1a1a2e;padding:16px;text-align:center;">
    <p style="color:#a8b2d1;font-size:11px;margin:0;">© ${new Date().getFullYear()} REBAR.SHOP — All rights reserved</p>
  </div>
</div>`;

        // Send via Gmail
        const emailRes = await fetch(
          `${supabaseUrl}/functions/v1/gmail-send`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": authHeader },
            body: JSON.stringify({ to: toEmail, subject, body: htmlBody }),
          }
        );

        if (emailRes.ok) {
          // Update quotation status to "sent"
          await svcClient
            .from("sales_quotations")
            .update({ status: "sent" })
            .eq("id", quotationId);

          result.result = {
            success: true,
            message: `Quotation ${quote.quotation_number} emailed to ${toEmail}`,
            quotation_number: quote.quotation_number,
            to: toEmail,
          };
          result.sideEffects.emails = [{ to: toEmail }];
        } else {
          result.result = { success: false, error: await emailRes.text() };
        }
      }
    }

    // ═══════════════════════════════════════════════════
    // Convert Quotation to Invoice + Stripe + Email
    // ═══════════════════════════════════════════════════
    else if (name === "convert_quotation_to_invoice") {
      const quotationId = args.quotation_id;
      const customerEmail = args.customer_email;

      // 1. Fetch quotation
      const { data: quote, error: qFetchErr } = await svcClient
        .from("sales_quotations")
        .select("*")
        .eq("id", quotationId)
        .single();

      if (qFetchErr || !quote) {
        result.result = { error: qFetchErr?.message || "Quotation not found" };
      } else {
        // 2. Generate invoice number INV-{YYYY}{NNNN}
        const year = new Date().getFullYear();
        const { data: latestInv } = await svcClient
          .from("sales_invoices")
          .select("invoice_number")
          .like("invoice_number", `INV-${year}%`)
          .order("invoice_number", { ascending: false })
          .limit(1);

        let invSeq = 1;
        if (latestInv && latestInv.length > 0) {
          const lastNum = parseInt(latestInv[0].invoice_number.replace(`INV-${year}`, ""), 10);
          if (!isNaN(lastNum)) invSeq = lastNum + 1;
        }
        const invoiceNumber = `INV-${year}${String(invSeq).padStart(4, "0")}`;

        const issuedDate = new Date().toISOString().split("T")[0];
        const dueDate = args.due_date || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

        // 3. Insert sales invoice
        const { data: newInvoice, error: invErr } = await svcClient
          .from("sales_invoices")
          .insert({
            company_id: companyId,
            invoice_number: invoiceNumber,
            quotation_id: quotationId,
            customer_name: quote.customer_name,
            customer_company: quote.customer_company,
            amount: quote.amount,
            status: "sent",
            issued_date: issuedDate,
            due_date: dueDate,
            notes: quote.notes,
            sales_lead_id: quote.lead_id || null,
          })
          .select()
          .single();

        if (invErr) {
          result.result = { error: `Invoice creation failed: ${invErr.message}` };
        } else {
          // 4. Generate Stripe payment link
          let stripePaymentUrl = "";
          let stripeError = "";
          try {
            const stripeRes = await fetch(
              `${supabaseUrl}/functions/v1/stripe-payment`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": authHeader },
                body: JSON.stringify({
                  action: "create-payment-link",
                  amount: quote.amount,
                  currency: "cad",
                  invoiceNumber: invoiceNumber,
                  customerName: quote.customer_name || quote.customer_company || "Customer",
                  qbInvoiceId: newInvoice.id,
                }),
              }
            );
            if (stripeRes.ok) {
              const stripeData = await stripeRes.json();
              stripePaymentUrl = stripeData.paymentLink?.stripe_url || "";
            } else {
              stripeError = await stripeRes.text();
              console.warn("Stripe payment link failed:", stripeError);
            }
          } catch (e) {
            stripeError = e instanceof Error ? e.message : String(e);
            console.warn("Stripe payment link error:", stripeError);
          }

          // 5. Build professional invoice email HTML
          const senderName = context?.currentUser?.name || "Sales Team";
          const senderEmail = context?.currentUser?.email || "sales@rebar.shop";
          const customerName = quote.customer_name || "Valued Customer";

          const lineItemsHtml = quote.notes?.includes("--- Line Items ---")
            ? quote.notes.split("--- Line Items ---")[1]
                .trim()
                .split("\n")
                .filter((l: string) => l.startsWith("•"))
                .map((l: string) => `<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#333;">${l.replace("• ", "")}</td></tr>`)
                .join("")
            : "";

          const payNowButton = stripePaymentUrl
            ? `<div style="text-align:center;margin:32px 0;">
                <a href="${stripePaymentUrl}" style="display:inline-block;background:linear-gradient(135deg,#e94560 0%,#c23152 100%);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:8px;font-size:18px;font-weight:700;letter-spacing:1px;box-shadow:0 4px 14px rgba(233,69,96,0.4);">💳 Pay Now</a>
                <p style="color:#888;font-size:12px;margin-top:10px;">Secure payment powered by Stripe</p>
               </div>`
            : "";

          const htmlBody = `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;">
  <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px;text-align:center;">
    <h1 style="color:#e94560;font-size:28px;margin:0;letter-spacing:2px;">REBAR.SHOP</h1>
    <p style="color:#a8b2d1;font-size:13px;margin:6px 0 0;">Premium Steel Reinforcement — Ontario, Canada</p>
  </div>
  <div style="padding:32px;">
    <p style="font-size:16px;color:#333;">Dear ${customerName},</p>
    <p style="font-size:15px;color:#555;line-height:1.6;">Thank you for confirming your order. Please find your invoice below.</p>
    
    <div style="background:#f8f9fc;border-radius:8px;padding:20px;margin:24px 0;border-left:4px solid #e94560;">
      <table style="width:100%;">
        <tr><td style="color:#888;font-size:13px;padding:4px 0;">Invoice #</td><td style="text-align:right;font-weight:600;color:#1a1a2e;">${invoiceNumber}</td></tr>
        <tr><td style="color:#888;font-size:13px;padding:4px 0;">Amount Due</td><td style="text-align:right;font-weight:700;color:#e94560;font-size:22px;">$${(quote.amount || 0).toLocaleString("en-CA", { minimumFractionDigits: 2 })} CAD</td></tr>
        <tr><td style="color:#888;font-size:13px;padding:4px 0;">Issue Date</td><td style="text-align:right;color:#1a1a2e;">${issuedDate}</td></tr>
        <tr><td style="color:#888;font-size:13px;padding:4px 0;">Due Date</td><td style="text-align:right;color:#1a1a2e;font-weight:600;">${dueDate}</td></tr>
      </table>
    </div>

    ${lineItemsHtml ? `
    <h3 style="color:#1a1a2e;font-size:16px;margin:24px 0 12px;">Invoice Details</h3>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr><th style="text-align:left;padding:10px 14px;background:#f1f3f9;color:#555;font-size:13px;border-bottom:2px solid #e5e7eb;">Item</th></tr></thead>
      <tbody>${lineItemsHtml}</tbody>
    </table>` : ""}

    ${payNowButton}

    <p style="font-size:14px;color:#555;line-height:1.6;margin-top:24px;">
      All amounts are in Canadian Dollars (CAD). Applicable taxes (13% HST) will be added at checkout.
      Payment is due by <strong>${dueDate}</strong>.
    </p>
    <p style="font-size:14px;color:#555;">If you have any questions about this invoice, please don't hesitate to reach out.</p>
    
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-weight:600;color:#1a1a2e;">${senderName}</p>
      <p style="margin:2px 0;color:#e94560;font-size:13px;">Sales Representative</p>
      <p style="margin:2px 0;color:#888;font-size:13px;">REBAR.SHOP — Premium Steel Reinforcement</p>
      <p style="margin:2px 0;color:#888;font-size:13px;">📞 (905) 761-1311 &nbsp;|&nbsp; ✉️ ${senderEmail}</p>
      <p style="margin:2px 0;color:#888;font-size:13px;">🌐 www.rebar.shop &nbsp;|&nbsp; 📍 Vaughan, Ontario</p>
    </div>
  </div>
  <div style="background:#1a1a2e;padding:16px;text-align:center;">
    <p style="color:#a8b2d1;font-size:11px;margin:0;">© ${new Date().getFullYear()} REBAR.SHOP — All rights reserved</p>
  </div>
</div>`;

          // 6. Send invoice email via Gmail
          const emailRes = await fetch(
            `${supabaseUrl}/functions/v1/gmail-send`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": authHeader },
              body: JSON.stringify({
                to: customerEmail,
                subject: `Invoice ${invoiceNumber} — REBAR.SHOP`,
                body: htmlBody,
              }),
            }
          );

          // 7. Update quotation status to approved
          await svcClient
            .from("sales_quotations")
            .update({ status: "approved" })
            .eq("id", quotationId);

          if (emailRes.ok) {
            result.result = {
              success: true,
              invoice_id: newInvoice.id,
              invoice_number: invoiceNumber,
              payment_link: stripePaymentUrl || "Payment link generation failed — invoice sent without it",
              message: `✅ Invoice ${invoiceNumber} created and sent to ${customerEmail}${stripePaymentUrl ? " with payment link" : ""}`,
            };
            result.sideEffects.emails = [{ to: customerEmail }];
          } else {
            const emailError = await emailRes.text();
            result.result = {
              success: false,
              invoice_id: newInvoice.id,
              invoice_number: invoiceNumber,
              error: `Invoice created but email failed: ${emailError}`,
            };
          }
        }
      }
    }

    // Default fallback
    else {
      result.result = { success: true, message: "Tool executed (simulated)" };
    }

  } catch (err) {
    result.result = { error: err instanceof Error ? err.message : String(err) };
  }

  return result;
}
