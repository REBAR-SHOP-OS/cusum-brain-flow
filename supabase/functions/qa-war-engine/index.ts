import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 25;
const TOTAL_BATCHES = 20;
const DELAY_MS = 3000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function hashBugId(module: string, title: string): string {
  let h = 0;
  const s = `${module}::${title}`.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth check — user must be admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, supabaseKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get company_id from profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const companyId = profile.company_id;

    // Create run record
    const { data: run, error: runErr } = await adminClient
      .from("qa_war_runs")
      .insert({ company_id: companyId, status: "running", total_scenarios: BATCH_SIZE * TOTAL_BATCHES })
      .select()
      .single();

    if (runErr || !run) {
      return new Response(JSON.stringify({ error: "Failed to create run", details: runErr }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather system context
    const { data: tables } = await adminClient.rpc("execute_readonly_query", {
      query_text: `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position LIMIT 2000`,
    }).catch(() => ({ data: null }));

    // Fallback: query tables directly if RPC doesn't exist
    let schemaContext = "Schema not available";
    if (tables && Array.isArray(tables)) {
      const grouped: Record<string, string[]> = {};
      for (const r of tables) {
        const t = r.table_name;
        if (!grouped[t]) grouped[t] = [];
        grouped[t].push(`${r.column_name} (${r.data_type}${r.is_nullable === 'YES' ? ', nullable' : ''})`);
      }
      schemaContext = Object.entries(grouped)
        .map(([t, cols]) => `${t}: ${cols.join(", ")}`)
        .join("\n");
    } else {
      // Direct query fallback
      const { data: directTables } = await adminClient
        .from("information_schema.columns" as any)
        .select("table_name, column_name, data_type, is_nullable")
        .eq("table_schema", "public")
        .limit(2000);
      if (directTables && Array.isArray(directTables)) {
        const grouped: Record<string, string[]> = {};
        for (const r of directTables as any[]) {
          const t = r.table_name;
          if (!grouped[t]) grouped[t] = [];
          grouped[t].push(`${r.column_name} (${r.data_type}${r.is_nullable === 'YES' ? ', nullable' : ''})`);
        }
        schemaContext = Object.entries(grouped)
          .map(([t, cols]) => `${t}: ${cols.join(", ")}`)
          .join("\n");
      }
    }

    // Get existing bug_ids for dedup
    const { data: existingBugs } = await adminClient
      .from("qa_war_bugs")
      .select("bug_id, status")
      .eq("company_id", companyId);
    const existingBugMap = new Map<string, string>();
    if (existingBugs) {
      for (const b of existingBugs) existingBugMap.set(b.bug_id, b.status);
    }

    const systemPrompt = `You are a QA War Engine stress-testing an ERP system built on Supabase. You have FULL knowledge of:

DATABASE SCHEMA:
${schemaContext.slice(0, 12000)}

ROLE SYSTEM: admin, sales, accounting, office, workshop, field, shop_supervisor, customer
All tables use company_id for multi-tenant isolation. RLS uses has_role(auth.uid(), role) SECURITY DEFINER function.

KEY PATTERNS:
- company_id required on all inserts
- dedupe_key on activity_events prevents duplicate event logging
- Status transition maps enforce valid state changes (e.g. delivery: pending→in_transit→delivered)
- Pipeline stages: lead→qualified→proposal→negotiation→closed_won/closed_lost
- Order statuses: draft→confirmed→in_production→ready→delivered→invoiced→paid

EDGE FUNCTIONS: ai-agent, qb-webhook, gmail-webhook, pipeline-webhooks, manage-inventory, support-chat, vizzy-daily-brief, generate-fix-prompt, and 120+ more

Generate exactly ${BATCH_SIZE} bug reports for this batch. Distribution:
- 8 normal business flow bugs
- 5 edge case bugs  
- 4 concurrency bugs
- 3 permission abuse bugs
- 3 integration failure bugs
- 3 corrupt/invalid data bugs
- 1 extreme stress bug

RULES:
- Never assume the system is correct
- Assume concurrent users, malicious actors, flaky network
- Each bug must have concrete steps_to_repro against real tables/endpoints
- Reference actual column names and table names from the schema
- Propose code-level fixes
- Each bug title must be unique and specific`;

    const bugToolSchema = {
      type: "function" as const,
      function: {
        name: "report_bugs",
        description: "Report discovered bugs from QA war simulation",
        parameters: {
          type: "object",
          properties: {
            bugs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Concise bug title max 120 chars" },
                  module: {
                    type: "string",
                    enum: ["dashboard", "customers", "crm", "orders", "deliveries", "production", "machines", "timeclock", "social", "inventory", "team", "accounting", "integrations", "auth", "notifications", "ai_agents"],
                  },
                  severity: { type: "string", enum: ["S0", "S1", "S2", "S3"] },
                  priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
                  type: { type: "string", enum: ["UI", "API", "Data", "Permissions", "Performance", "Reliability"] },
                  steps_to_repro: { type: "array", items: { type: "string" } },
                  expected: { type: "string" },
                  actual: { type: "string" },
                  suspected_root_cause: { type: "string" },
                  fix_proposal: { type: "string" },
                  scenario_category: {
                    type: "string",
                    enum: ["normal", "edge_case", "concurrency", "permission_abuse", "integration", "corrupt_data", "stress"],
                  },
                },
                required: ["title", "module", "severity", "priority", "type", "steps_to_repro", "expected", "actual", "suspected_root_cause", "fix_proposal", "scenario_category"],
              },
            },
          },
          required: ["bugs"],
        },
      },
    };

    let totalBugsFound = 0;
    const allBugSummaries: any[] = [];

    for (let batch = 0; batch < TOTAL_BATCHES; batch++) {
      try {
        const batchPrompt = `Batch ${batch + 1}/${TOTAL_BATCHES}. Generate ${BATCH_SIZE} unique bug reports. Focus on DIFFERENT areas than previous batches. Batch theme: ${
          batch < 6 ? "normal business flows" :
          batch < 10 ? "edge cases and boundary conditions" :
          batch < 13 ? "concurrency and race conditions" :
          batch < 15 ? "permission abuse and auth bypass" :
          batch < 17 ? "integration failures and webhook edge cases" :
          batch < 19 ? "corrupt data and schema violations" :
          "extreme stress and load scenarios"
        }`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: batchPrompt },
            ],
            tools: [bugToolSchema],
            tool_choice: { type: "function", function: { name: "report_bugs" } },
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`Batch ${batch + 1} AI error: ${aiResponse.status}`, errText);
          if (aiResponse.status === 429 || aiResponse.status === 402) {
            // Wait longer and retry once
            await sleep(10000);
            continue;
          }
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall?.function?.arguments) {
          console.error(`Batch ${batch + 1}: No tool call in response`);
          continue;
        }

        let bugs: any[];
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          bugs = parsed.bugs || [];
        } catch {
          console.error(`Batch ${batch + 1}: Failed to parse tool call args`);
          continue;
        }

        // Process and insert bugs
        const bugsToInsert = [];
        for (const bug of bugs) {
          const bugId = hashBugId(bug.module, bug.title);
          const existingStatus = existingBugMap.get(bugId);
          let status = "new";
          if (existingStatus === "fixed") {
            status = "regression";
          } else if (existingStatus) {
            status = "known";
          }

          existingBugMap.set(bugId, status);

          bugsToInsert.push({
            run_id: run.id,
            bug_id: bugId,
            title: bug.title,
            module: bug.module,
            severity: bug.severity,
            priority: bug.priority,
            type: bug.type,
            steps_to_repro: bug.steps_to_repro,
            expected: bug.expected,
            actual: bug.actual,
            suspected_root_cause: bug.suspected_root_cause,
            fix_proposal: bug.fix_proposal,
            scenario_category: bug.scenario_category,
            status,
            company_id: companyId,
          });
        }

        if (bugsToInsert.length > 0) {
          try {
            const { error: insertErr } = await adminClient
              .from("qa_war_bugs")
              .insert(bugsToInsert);
            if (insertErr) {
              console.error(`Batch ${batch + 1} insert error:`, insertErr);
            } else {
              totalBugsFound += bugsToInsert.length;
              allBugSummaries.push(...bugsToInsert.map(b => ({
                module: b.module,
                severity: b.severity,
                type: b.type,
                category: b.scenario_category,
              })));
            }
          } catch (e) {
            console.error(`Batch ${batch + 1} insert exception:`, e);
          }
        }

        // Update run progress
        try {
          await adminClient
            .from("qa_war_runs")
            .update({ bugs_found: totalBugsFound })
            .eq("id", run.id);
        } catch {}

        console.log(`Batch ${batch + 1}/${TOTAL_BATCHES} done: ${bugsToInsert.length} bugs`);

        if (batch < TOTAL_BATCHES - 1) {
          await sleep(DELAY_MS);
        }
      } catch (batchErr) {
        console.error(`Batch ${batch + 1} error:`, batchErr);
        continue;
      }
    }

    // Generate summary
    const severityCounts: Record<string, number> = {};
    const moduleCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};

    for (const b of allBugSummaries) {
      severityCounts[b.severity] = (severityCounts[b.severity] || 0) + 1;
      moduleCounts[b.module] = (moduleCounts[b.module] || 0) + 1;
      typeCounts[b.type] = (typeCounts[b.type] || 0) + 1;
      categoryCounts[b.category] = (categoryCounts[b.category] || 0) + 1;
    }

    // Compute debt score (rough heuristic)
    const s0 = severityCounts["S0"] || 0;
    const s1 = severityCounts["S1"] || 0;
    const s2 = severityCounts["S2"] || 0;
    const debtScore = Math.min(100, Math.round((s0 * 10 + s1 * 5 + s2 * 2) / (totalBugsFound || 1) * 20));

    const summary = {
      total_bugs: totalBugsFound,
      by_severity: severityCounts,
      by_module: moduleCounts,
      by_type: typeCounts,
      by_category: categoryCounts,
      technical_debt_score: debtScore,
      top_risk_modules: Object.entries(moduleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([m, c]) => `${m} (${c} bugs)`),
    };

    // Finalize run
    try {
      await adminClient
        .from("qa_war_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          bugs_found: totalBugsFound,
          summary,
        })
        .eq("id", run.id);
    } catch {}

    return new Response(JSON.stringify({ run_id: run.id, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("qa-war-engine error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
