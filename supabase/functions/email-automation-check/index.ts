import { handleRequest } from "../_shared/requestHandler.ts";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { serviceClient: supabase } = ctx;

    // 1. Get all enabled automations
    const { data: automations, error: autoErr } = await supabase
      .from("email_automations")
      .select("*")
      .eq("enabled", true);

    if (autoErr) throw autoErr;
    if (!automations || automations.length === 0) {
      return { message: "No enabled automations" };
    }

    const results: Record<string, { triggered: boolean; campaigns_created: number; reason?: string }> = {};

    for (const automation of automations) {
      const key = automation.automation_key;
      const config = automation.config || {};
      const companyId = automation.company_id;

      try {
        let contactIds: string[] = [];

        switch (key) {
          case "abandoned_cart": {
            const delayHours = (config as any).delay_hours || 48;
            const cutoff = new Date(Date.now() - delayHours * 3600 * 1000).toISOString();
            const { data: staleQuotes } = await supabase
              .from("leads")
              .select("id, contact_id")
              .eq("company_id", companyId)
              .eq("stage", "quotation_priority")
              .lt("updated_at", cutoff)
              .limit(20);

            if (staleQuotes?.length) {
              contactIds = staleQuotes
                .map((q: any) => q.contact_id)
                .filter(Boolean);
            }
            break;
          }

          case "welcome_series": {
            const delayHours = (config as any).delay_hours || 24;
            const since = new Date(Date.now() - delayHours * 3600 * 1000).toISOString();
            const { data: newContacts } = await supabase
              .from("contacts")
              .select("id")
              .eq("company_id", companyId)
              .gte("created_at", since)
              .limit(50);

            if (newContacts?.length) {
              contactIds = newContacts.map((c: any) => c.id);
            }
            break;
          }

          case "upsell_email": {
            const delayHours = (config as any).delay_hours || 72;
            const cutoff = new Date(Date.now() - delayHours * 3600 * 1000).toISOString();
            const { data: recentOrders } = await supabase
              .from("orders")
              .select("id, customer_id")
              .eq("company_id", companyId)
              .in("status", ["paid", "closed"])
              .lt("updated_at", cutoff)
              .gte("updated_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
              .limit(20);

            if (recentOrders?.length) {
              const customerIds = [...new Set(recentOrders.map((o: any) => o.customer_id).filter(Boolean))];
              if (customerIds.length) {
                const { data: contacts } = await supabase
                  .from("contacts")
                  .select("id")
                  .in("customer_id", customerIds)
                  .eq("is_primary", true)
                  .limit(20);
                contactIds = (contacts || []).map((c: any) => c.id);
              }
            }
            break;
          }

          case "winback": {
            const inactiveDays = (config as any).inactive_days || 90;
            const cutoff = new Date(Date.now() - inactiveDays * 24 * 3600 * 1000).toISOString();
            const { data: staleCustomers } = await supabase
              .from("customers")
              .select("id")
              .eq("company_id", companyId)
              .lt("updated_at", cutoff)
              .eq("status", "active")
              .limit(20);

            if (staleCustomers?.length) {
              const custIds = staleCustomers.map((c: any) => c.id);
              const { data: contacts } = await supabase
                .from("contacts")
                .select("id")
                .in("customer_id", custIds)
                .eq("is_primary", true)
                .limit(20);
              contactIds = (contacts || []).map((c: any) => c.id);
            }
            break;
          }

          default: {
            results[key] = { triggered: false, campaigns_created: 0, reason: "Trigger not implemented yet" };
            continue;
          }
        }

        contactIds = [...new Set(contactIds)];
        if (contactIds.length === 0) {
          results[key] = { triggered: false, campaigns_created: 0, reason: "No qualifying contacts" };
          continue;
        }

        const { data: existing } = await supabase
          .from("email_campaigns")
          .select("id")
          .eq("company_id", companyId)
          .eq("campaign_type", automation.campaign_type)
          .eq("status", "pending_approval")
          .ilike("title", `%${automation.name}%`)
          .limit(1);

        if (existing && existing.length > 0) {
          results[key] = { triggered: false, campaigns_created: 0, reason: "Pending campaign already exists" };
          continue;
        }

        const { error: insertErr } = await supabase.from("email_campaigns").insert({
          title: `[Auto] ${automation.name} — ${new Date().toLocaleDateString()}`,
          campaign_type: automation.campaign_type,
          status: "pending_approval",
          company_id: companyId,
          estimated_recipients: contactIds.length,
          segment_rules: { automation_key: key, contact_ids: contactIds },
          metadata: { automation_id: automation.id, trigger_type: automation.trigger_type },
        });

        if (insertErr) throw insertErr;

        await supabase
          .from("email_automations")
          .update({
            last_triggered_at: new Date().toISOString(),
            campaigns_generated: (automation.campaigns_generated || 0) + 1,
          } as any)
          .eq("id", automation.id);

        results[key] = { triggered: true, campaigns_created: 1 };
      } catch (triggerErr: any) {
        results[key] = { triggered: false, campaigns_created: 0, reason: triggerErr.message };
      }
    }

    return { results };
  }, { functionName: "email-automation-check", authMode: "none", requireCompany: false, wrapResult: false })
);
