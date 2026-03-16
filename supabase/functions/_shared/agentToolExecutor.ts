
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
          let imagePrompt = args.prompt || "A professional rebar construction image";
          const slot = args.slot || "";

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

            // Inject aspect ratio from user selection (context = user's UI choice, more reliable than AI args)
            const aspectRatio = (context?.imageAspectRatio as string) || args.aspect_ratio || "1:1";
            console.log(`[generate_image] aspectRatio resolved: args=${args.aspect_ratio}, context=${context?.imageAspectRatio}, final=${aspectRatio}`);
            const AR_PROMPT_MAP: Record<string, string> = {
              "16:9": "CRITICAL: Generate a LANDSCAPE image with 16:9 aspect ratio. The image MUST be wider than tall.",
              "9:16": "CRITICAL: Generate a PORTRAIT image with 9:16 aspect ratio. The image MUST be taller than wide (suitable for Instagram Stories/Reels).",
              "1:1": "CRITICAL: Generate a perfectly SQUARE image with 1:1 aspect ratio. Width and height MUST be equal.",
            };
            imagePrompt += `\n\n${AR_PROMPT_MAP[aspectRatio] || `IMAGE ASPECT RATIO: ${aspectRatio}. Compose the image to fit this ratio perfectly.`}`;
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

          // Retry pipeline: try multiple models
          const attempts = [
            { model: "google/gemini-2.5-flash-image", useLogo: true },
            { model: "google/gemini-2.5-flash-image", useLogo: true },
            { model: "google/gemini-3-pro-image-preview", useLogo: true },
          ];

          let generated = false;
          let lastError = "Unknown";

          for (const attempt of attempts) {
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

            const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
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

            if (!aiRes.ok) { lastError = `${attempt.model}: ${aiRes.status}`; continue; }

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
            if (aspectRatio) {
              imageBytes = await cropToAspectRatio(imageBytes, aspectRatio);
            }

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

          // Fallback: if all attempts failed and ratio is not 1:1, retry with square ratio
          if (!generated && aspectRatio && aspectRatio !== "1:1") {
            console.log(`[generate_image] All attempts failed with ratio ${aspectRatio}, retrying with 1:1 fallback...`);
            for (const attempt of attempts) {
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

              const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: attempt.model,
                  messages: [{ role: "user", content: contentParts }],
                  modalities: ["image", "text"],
                  aspect_ratio: "1:1",
                }),
              });

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

    // Default fallback
    else {
      result.result = { success: true, message: "Tool executed (simulated)" };
    }

  } catch (err) {
    result.result = { error: err instanceof Error ? err.message : String(err) };
  }

  return result;
}
