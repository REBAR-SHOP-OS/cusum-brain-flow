
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // ═══════════════════════════════════════════════════
    // 6. Run Takeoff — POST to ai-estimate edge function
    // ═══════════════════════════════════════════════════
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
      const body = {
        action: args.action || "quote",
        estimate_request: args.estimate_request || args,
        company_id: companyId,
      };

      const qeRes = await fetch(`${supabaseUrl}/functions/v1/quote-engine`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": authHeader },
        body: JSON.stringify(body),
      });

      if (qeRes.ok) {
        const qeData = await qeRes.json();
        result.result = { success: true, ...qeData };
      } else {
        result.result = { success: false, error: await qeRes.text() };
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
          const imagePrompt = args.prompt || "A professional rebar construction image";
          const slot = args.slot || "";

          // Call Gemini image generation via Lovable AI gateway
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-pro-image-preview",
              messages: [
                {
                  role: "user",
                  content: imagePrompt,
                },
              ],
              modalities: ["image", "text"],
            }),
          });

          if (!aiRes.ok) {
            const errText = await aiRes.text();
            result.result = { error: `Image generation failed: ${aiRes.status} — ${errText}` };
          } else {
            const aiData = await aiRes.json();
            const images = aiData.choices?.[0]?.message?.images;

            if (!images || images.length === 0) {
              result.result = { error: "No image was generated by the model" };
            } else {
              const base64Url = images[0].image_url?.url;
              if (!base64Url) {
                result.result = { error: "Image data missing from response" };
              } else {
                // Convert base64 to bytes and upload to social-images bucket
                const base64Data = base64Url.replace(/^data:image\/\w+;base64,/, "");
                const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
                const imagePath = `pixel/${slot.replace(":", "")}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

                const { error: uploadError } = await svcClient.storage
                  .from("social-images")
                  .upload(imagePath, imageBytes, { contentType: "image/png" });

                if (uploadError) {
                  result.result = { error: `Upload failed: ${uploadError.message}` };
                } else {
                  const { data: urlData } = svcClient.storage.from("social-images").getPublicUrl(imagePath);
                  result.result = {
                    success: true,
                    image_url: urlData.publicUrl,
                    slot,
                    message: `Image generated and uploaded successfully for slot ${slot}`,
                  };
                }
              }
            }
          }
        } catch (imgErr) {
          result.result = { error: `Image generation error: ${imgErr instanceof Error ? imgErr.message : String(imgErr)}` };
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
