import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { trigger_event, lead, old_lead, company_id } = body;

    if (!trigger_event || !company_id) {
      return new Response(JSON.stringify({ error: "Missing trigger_event or company_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch enabled rules for this company and trigger event
    const { data: rules, error: rulesError } = await supabase
      .from("pipeline_automation_rules")
      .select("*")
      .eq("company_id", company_id)
      .eq("trigger_event", trigger_event)
      .eq("enabled", true)
      .order("priority", { ascending: true });

    if (rulesError) {
      console.error("Error fetching rules:", rulesError);
      return new Response(JSON.stringify({ error: rulesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ matched: 0, executed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let executed = 0;

    for (const rule of rules) {
      const conditions = rule.trigger_conditions as Record<string, any> || {};
      const params = rule.action_params as Record<string, any> || {};

      // Check conditions match
      if (!matchConditions(trigger_event, conditions, lead, old_lead)) continue;

      // Execute action
      try {
        await executeAction(supabase, rule.action_type, params, lead, company_id);

        // Update execution count
        try {
          await supabase
            .from("pipeline_automation_rules")
            .update({
              execution_count: (rule.execution_count || 0) + 1,
              last_executed_at: new Date().toISOString(),
            })
            .eq("id", rule.id);
        } catch (e) {
          console.warn("Failed to update execution count:", e);
        }

        executed++;
      } catch (e) {
        console.error(`Rule ${rule.id} execution failed:`, e);
      }
    }

    return new Response(
      JSON.stringify({ matched: rules.length, executed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pipeline-automation-engine error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function matchConditions(
  trigger: string,
  conditions: Record<string, any>,
  lead: any,
  oldLead?: any
): boolean {
  if (!lead) return false;

  switch (trigger) {
    case "stage_change": {
      if (conditions.from_stage && oldLead?.stage !== conditions.from_stage) return false;
      if (conditions.to_stage && lead.stage !== conditions.to_stage) return false;
      return true;
    }
    case "sla_breach":
      return lead.sla_breached === true;
    case "stale_lead": {
      const staleDays = conditions.stale_days || 14;
      const daysSinceUpdate = (Date.now() - new Date(lead.updated_at).getTime()) / 86400000;
      return daysSinceUpdate >= staleDays;
    }
    case "value_change": {
      if (conditions.min_value && (lead.expected_value || 0) < conditions.min_value) return false;
      return oldLead && lead.expected_value !== oldLead.expected_value;
    }
    case "new_lead":
      return true;
    default:
      return false;
  }
}

async function executeAction(
  supabase: any,
  actionType: string,
  params: Record<string, any>,
  lead: any,
  companyId: string
) {
  switch (actionType) {
    case "auto_notify": {
      const roles = params.notify_roles || ["admin"];
      // Get users with matching roles scoped to this company
      const { data: profileUsers } = await supabase
        .from("profiles")
        .select("user_id, user_roles!inner(role)")
        .eq("company_id", companyId)
        .eq("is_active", true);
      const users = (profileUsers || []).filter((p: any) =>
        p.user_roles?.some((r: any) => roles.includes(r.role))
      ).map((p: any) => ({ user_id: p.user_id }));

      if (users) {
        for (const u of users) {
          try {
            await supabase.from("notifications").insert({
              user_id: u.user_id,
              type: "notification",
              title: `🤖 Automation: ${params.title || "Pipeline rule triggered"}`,
              description: params.message || `Lead "${lead.title}" triggered an automation rule.`,
              priority: params.priority || "normal",
              link_to: "/pipeline",
              agent_name: "Blitz",
              status: "unread",
            });
          } catch (e) {
            console.warn("Failed to notify user:", e);
          }
        }
      }
      break;
    }
    case "auto_assign": {
      const assignTo = params.assign_to;
      if (assignTo && lead.id) {
        try {
          await supabase.from("leads").update({ assigned_to: assignTo }).eq("id", lead.id);
        } catch (e) {
          console.warn("Failed to auto-assign:", e);
        }
      }
      break;
    }
    case "auto_move_stage": {
      const targetStage = params.target_stage;
      if (targetStage && lead.id) {
        try {
          await supabase.from("leads").update({ stage: targetStage }).eq("id", lead.id);
        } catch (e) {
          console.warn("Failed to auto-move stage:", e);
        }
      }
      break;
    }
    case "auto_escalate": {
      const escalateTo = params.escalate_to || "Sales Mgr";
      if (lead.id) {
        try {
          await supabase.from("leads").update({ escalated_to: escalateTo }).eq("id", lead.id);
        } catch (e) {
          console.warn("Failed to escalate:", e);
        }

        const dedupeKey = `auto:escalate:${lead.id}:${Date.now()}`;
        try {
          await supabase.from("human_tasks").upsert({
            company_id: companyId,
            dedupe_key: dedupeKey,
            title: `Auto-escalated: ${lead.title}`,
            description: `Lead automatically escalated to ${escalateTo} by automation rule.`,
            severity: "warning",
            category: "automation",
            entity_type: "lead",
            entity_id: lead.id,
            status: "open",
          }, { onConflict: "dedupe_key", ignoreDuplicates: true });
        } catch (e) {
          console.warn("Failed to create human task:", e);
        }
      }
      break;
    }
    case "auto_tag": {
      const tag = params.tag;
      if (tag && lead.id) {
        const existingTags = (lead.tags || []) as string[];
        if (!existingTags.includes(tag)) {
          try {
            await supabase.from("leads").update({ tags: [...existingTags, tag] }).eq("id", lead.id);
          } catch (e) {
            console.warn("Failed to auto-tag:", e);
          }
        }
      }
      break;
    }
  }
}
