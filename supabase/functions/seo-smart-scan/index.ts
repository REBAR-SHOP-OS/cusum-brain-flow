import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { serviceClient: supabase, body, userId } = ctx;
    const { domain_id } = body;

    if (!domain_id) {
      return new Response(JSON.stringify({ error: "domain_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get domain
    const { data: domain, error: domainErr } = await supabase
      .from("seo_domains")
      .select("*")
      .eq("id", domain_id)
      .single();

    if (domainErr || !domain) {
      return new Response(JSON.stringify({ error: "Domain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    // ── Step 1: Detect available sources ──
    const sources: Record<string, boolean> = {
      gsc: false,
      wincher: false,
      semrush: false,
      site_crawl: true,   // always available
      link_audit: true,    // always available
      keyword_harvest: true, // always available
    };

    // Check GSC: prioritize ai@rebar.shop's token
    const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const aiAccount = usersData?.users?.find((u: any) => u.email === "ai@rebar.shop");

    if (aiAccount) {
      const { data: tok } = await supabase
        .from("user_gmail_tokens")
        .select("id")
        .eq("user_id", aiAccount.id)
        .maybeSingle();
      if (tok) sources.gsc = true;
    }

    // Fallback: check any company user
    if (!sources.gsc) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("company_id", domain.company_id)
        .limit(10);

      if (profiles?.length) {
        for (const p of profiles) {
          const { data: tok } = await supabase
            .from("user_gmail_tokens")
            .select("id")
            .eq("user_id", p.user_id)
            .maybeSingle();
          if (tok) { sources.gsc = true; break; }
        }
      }
    }

    // Check Wincher
    const wincherKey = Deno.env.get("WINCHER_API_KEY");
    if (wincherKey) sources.wincher = true;

    // Check SEMrush
    const semrushKey = Deno.env.get("SEMRUSH_API_KEY");
    if (semrushKey) sources.semrush = true;

    console.log("Smart scan sources:", sources);

    // ── Step 2: Run all available syncs in parallel ──
    const syncResults: Record<string, any> = {};
    const syncPromises: Promise<void>[] = [];

    const callFn = async (name: string, fnName: string, fnBody: Record<string, unknown>) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
          method: "POST", headers, body: JSON.stringify(fnBody),
        });
        const data = await res.json();
        syncResults[name] = { ok: res.ok, data };
        console.log(`${name}: ${res.ok ? "OK" : "FAIL"}`, JSON.stringify(data).slice(0, 200));
      } catch (e) {
        syncResults[name] = { ok: false, error: String(e) };
        console.error(`${name} error:`, e);
      }
    };

    if (sources.gsc) {
      syncPromises.push(callFn("gsc", "seo-gsc-sync", { domain_id, days: 28 }));
    }

    if (sources.wincher) {
      // Get wincher website_id from domain if stored
      syncPromises.push(callFn("wincher", "wincher-sync", {
        action: "full_export",
        domain_id,
        website_id: domain.wincher_website_id || undefined,
      }));
    }

    if (sources.semrush) {
      syncPromises.push(callFn("semrush", "semrush-api", {
        action: "domain_overview",
        domain: domain.domain,
        domain_id,
      }));
    }

    // Always run these
    syncPromises.push(callFn("site_crawl", "seo-site-crawl", { domain_id }));
    syncPromises.push(callFn("keyword_harvest", "seo-keyword-harvest", { domain_id }));

    await Promise.allSettled(syncPromises);

    const sourcesSynced = Object.entries(syncResults)
      .filter(([, v]) => v.ok)
      .map(([k]) => k);

    console.log(`Synced ${sourcesSynced.length} sources:`, sourcesSynced);

    // ── Step 3: Trigger AI analysis with refreshed data ──
    let analysisResult: any = null;
    try {
      const analyzeRes = await fetch(`${supabaseUrl}/functions/v1/seo-ai-analyze`, {
        method: "POST", headers, body: JSON.stringify({ domain_id }),
      });
      analysisResult = await analyzeRes.json();
      console.log("AI analysis:", analyzeRes.ok ? "OK" : "FAIL");
    } catch (e) {
      console.error("AI analysis error:", e);
    }

    // ── Step 4: Get newly created tasks and try auto-fixing ──
    const { data: newTasks } = await supabase
      .from("seo_tasks")
      .select("*")
      .eq("domain_id", domain_id)
      .eq("status", "open")
      .eq("created_by", "ai")
      .order("created_at", { ascending: false })
      .limit(50);

    let autoFixed = 0;
    let manualRequired = 0;
    const autoFixResults: string[] = [];

    for (const task of newTasks || []) {
      // Only attempt auto-fix for content/technical tasks that WP can handle
      const autoFixableTypes = ["content", "technical"];
      if (!autoFixableTypes.includes(task.task_type)) {
        manualRequired++;
        continue;
      }

      try {
        // Ask task executor to analyze
        const analyzeRes = await fetch(`${supabaseUrl}/functions/v1/seo-task-execute`, {
          method: "POST", headers,
          body: JSON.stringify({ task_id: task.id, phase: "analyze" }),
        });
        const plan = await analyzeRes.json();

        if (plan?.can_execute && plan.actions?.length) {
          // Auto-execute
          const execRes = await fetch(`${supabaseUrl}/functions/v1/seo-task-execute`, {
            method: "POST", headers,
            body: JSON.stringify({ task_id: task.id, phase: "execute" }),
          });
          const execData = await execRes.json();
          if (execData?.success) {
            autoFixed++;
            autoFixResults.push(`✅ ${task.title}`);
          } else {
            manualRequired++;
            autoFixResults.push(`❌ ${task.title}: ${execData?.error || "failed"}`);
          }
        } else {
          manualRequired++;
          // Update task with human steps if provided
          if (plan?.human_steps) {
            await supabase.from("seo_tasks").update({
              execution_log: { human_steps: plan.human_steps, plan_summary: plan.plan_summary },
            }).eq("id", task.id);
          }
        }
      } catch (e) {
        manualRequired++;
        console.error(`Auto-fix failed for task ${task.id}:`, e);
      }
    }

    const summary = {
      sources_detected: sources,
      sources_synced: sourcesSynced,
      sync_results: syncResults,
      analysis: analysisResult ? {
        keywords_analyzed: analysisResult.ai_keywords_updated || 0,
        pages_analyzed: analysisResult.ai_pages_updated || 0,
        insights_created: analysisResult.insights_created || 0,
        tasks_created: analysisResult.tasks_created || 0,
      } : null,
      auto_fixed: autoFixed,
      manual_required: manualRequired,
      auto_fix_details: autoFixResults,
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }, { functionName: "seo-smart-scan", authMode: "required", requireCompany: false, wrapResult: false })
);
