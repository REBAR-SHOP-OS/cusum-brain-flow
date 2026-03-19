import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Use getUser() instead of deprecated getClaims()
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = user.id;

    // Only allow admin role
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: corsHeaders });
    }

    const { action, params } = await req.json();
    if (!action) {
      return new Response(JSON.stringify({ error: "action required" }), { status: 400, headers: corsHeaders });
    }

    let result: any;

    switch (action) {
      case "update_cut_plan_status": {
        const { id, status } = params;
        const { data, error } = await supabaseAdmin.from("cut_plans").update({ status }).eq("id", id).select().single();
        if (error) throw error;
        result = { success: true, message: `Cut plan updated to ${status}`, data };
        break;
      }

      case "update_lead_status": {
        const { id, status } = params;
        const { data, error } = await supabaseAdmin.from("leads").update({ status }).eq("id", id).select().single();
        if (error) throw error;
        result = { success: true, message: `Lead status updated to ${status}`, data };
        break;
      }

      case "update_machine_status": {
        const { id, status } = params;
        const { data, error } = await supabaseAdmin.from("machines").update({ status }).eq("id", id).select().single();
        if (error) throw error;
        result = { success: true, message: `Machine status changed to ${status}`, data };
        break;
      }

      case "create_event": {
        const { entity_type, entity_id, event_type, description } = params;
        const { data: profile } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).single();
      const { data, error } = await supabaseAdmin.from("activity_events").insert({
          company_id: profile?.company_id,
          entity_type,
          entity_id: entity_id || crypto.randomUUID(),
          event_type,
          description,
          actor_id: userId,
          actor_type: "vizzy",
          source: "system",
        }).select().single();
        if (error) throw error;
        result = { success: true, message: `Event logged: ${event_type}`, data };
        break;
      }

      case "update_delivery_status": {
        const { id, status } = params;
        const { data, error } = await supabaseAdmin.from("deliveries").update({ status }).eq("id", id).select().single();
        if (error) throw error;
        result = { success: true, message: `Delivery status updated to ${status}`, data };
        break;
      }

      case "update_cut_plan_item": {
        const { id, updates } = params;
        const safeUpdates: any = {};
        if (updates.phase) safeUpdates.phase = updates.phase;
        // completed_pieces is guarded — only atomic increment RPC may modify it
        if (updates.notes) safeUpdates.notes = updates.notes;
        if (updates.needs_fix !== undefined) safeUpdates.needs_fix = updates.needs_fix;
        const { data, error } = await supabaseAdmin.from("cut_plan_items").update(safeUpdates).eq("id", id).select().single();
        if (error) throw error;
        result = { success: true, message: `Cut plan item updated`, data };
        break;
      }

      case "log_fix_request": {
        const { description, affected_area, photo_url } = params;
        const { data, error } = await supabaseAdmin.from("vizzy_fix_requests").insert({
          user_id: userId,
          description,
          affected_area: affected_area || null,
          photo_url: photo_url || null,
        }).select().single();
        if (error) throw error;
        result = { success: true, message: `Fix request logged: ${description.slice(0, 60)}`, data };
        break;
      }

      // ─── Customer / Contact Connector Tools ───

      case "get_customer": {
        const { id } = params;
        const { data: prof } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).single();
        const { data, error } = await supabaseAdmin
          .from("customers")
          .select("*")
          .eq("id", id)
          .eq("company_id", prof?.company_id)
          .single();
        if (error) throw error;
        result = { success: true, data };
        break;
      }

      case "update_customer": {
        const { id, payload } = params;
        // suppress_external_sync defaults true — we simply never call any sync
        const { data: prof } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).single();

        // Fetch current record
        const { data: existing, error: fetchErr } = await supabaseAdmin
          .from("customers").select("*").eq("id", id).eq("company_id", prof?.company_id).single();
        if (fetchErr) throw fetchErr;

        // Block editing archived duplicates except status/merge fields
        if (existing.status === "archived" && existing.merged_into_customer_id) {
          const mergeOnlyKeys = ["status", "merged_into_customer_id", "merged_at", "merged_by", "merge_reason"];
          const payloadKeys = Object.keys(payload || {});
          const hasNonMerge = payloadKeys.some((k: string) => !mergeOnlyKeys.includes(k));
          if (hasNonMerge) {
            return new Response(JSON.stringify({ error: "Cannot edit archived/merged customer except merge metadata" }), { status: 400, headers: corsHeaders });
          }
        }

        // Whitelist safe fields (no quickbooks_id, no integration columns)
        const allowed = [
          "name", "company_name", "first_name", "last_name", "middle_name",
          "email", "phone", "mobile", "fax", "other_phone", "website",
          "billing_street1", "billing_street2", "billing_city", "billing_province", "billing_postal_code", "billing_country",
          "shipping_street1", "shipping_street2", "shipping_city", "shipping_province", "shipping_postal_code", "shipping_country",
          "customer_type", "status", "credit_limit", "payment_terms", "notes",
          "title", "suffix", "print_on_check_name",
          "merged_into_customer_id", "merged_at", "merged_by", "merge_reason",
        ];
        const safePayload: any = {};
        for (const k of Object.keys(payload || {})) {
          if (allowed.includes(k)) safePayload[k] = payload[k];
        }
        safePayload.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin.from("customers").update(safePayload).eq("id", id).select().single();
        if (error) throw error;
        result = { success: true, message: "Customer updated (ERP only, no external sync)", data };
        break;
      }

      case "list_contacts": {
        const { company_id: custId, limit: lim, offset: off } = params;
        let q = supabaseAdmin.from("contacts").select("*").eq("customer_id", custId);
        if (lim) q = q.limit(lim);
        if (off) q = q.range(off, off + (lim || 50) - 1);
        const { data, error } = await q;
        if (error) throw error;
        result = { success: true, data };
        break;
      }

      case "create_contact": {
        const { company_id: custId, payload: cp } = params;
        // Dedup check
        if (cp.email) {
          const { data: dup } = await supabaseAdmin.from("contacts").select("id").eq("customer_id", custId).eq("email", cp.email);
          if (dup && dup.length > 0) {
            return new Response(JSON.stringify({ error: `Contact with email ${cp.email} already exists for this customer` }), { status: 409, headers: corsHeaders });
          }
        } else if (cp.phone) {
          const { data: dup } = await supabaseAdmin.from("contacts").select("id").eq("customer_id", custId).eq("phone", cp.phone);
          if (dup && dup.length > 0) {
            return new Response(JSON.stringify({ error: `Contact with phone ${cp.phone} already exists for this customer` }), { status: 409, headers: corsHeaders });
          }
        }
        const { data, error } = await supabaseAdmin.from("contacts").insert({
          customer_id: custId,
          first_name: cp.first_name,
          last_name: cp.last_name || null,
          email: cp.email || null,
          phone: cp.phone || null,
          role: cp.role || null,
          is_primary: cp.is_primary || false,
        }).select().single();
        if (error) throw error;
        result = { success: true, message: `Contact created: ${cp.first_name} ${cp.last_name || ""}`, data };
        break;
      }

      case "merge_customers": {
        const { primary_id, duplicate_ids, dry_run, merge_reason: reason } = params;
        // suppress_external_sync defaults true — no QB/Odoo writes ever

        const { data: prof } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).single();
        const companyId = prof?.company_id;

        // Validate primary exists and is active
        const { data: primary, error: pErr } = await supabaseAdmin
          .from("customers").select("*").eq("id", primary_id).eq("company_id", companyId).single();
        if (pErr || !primary) throw new Error("Primary customer not found or not in your company");

        // Tables with customer_id FK to customers
        const relinkTables = [
          "contacts", "orders", "quotes", "projects", "delivery_stops",
          "leads", "communications", "estimation_projects", "pickup_orders",
          "tasks", "recurring_transactions", "customer_health_scores",
          "client_performance_memory", "customer_user_links", "lead_outcome_memory",
          "accounting_mirror", "gl_lines", "chat_threads",
        ];

        const allResults: any[] = [];

        for (const dupId of duplicate_ids) {
          // Idempotency: skip already merged
          const { data: dup, error: dErr } = await supabaseAdmin
            .from("customers").select("*").eq("id", dupId).eq("company_id", companyId).single();
          if (dErr || !dup) {
            allResults.push({ duplicate_id: dupId, skipped: true, reason: "Not found or not in company" });
            continue;
          }
          if (dup.merged_into_customer_id === primary_id) {
            allResults.push({ duplicate_id: dupId, skipped: true, reason: "Already merged into primary" });
            continue;
          }

          // Count affected rows per table
          const counts: any = {};
          for (const table of relinkTables) {
            const { count } = await supabaseAdmin
              .from(table).select("*", { count: "exact", head: true }).eq("customer_id", dupId);
            counts[table] = count || 0;
          }

          if (dry_run) {
            allResults.push({ duplicate_id: dupId, duplicate_name: dup.name, counts, actions_preview: "Would re-link all rows and archive duplicate" });
            continue;
          }

          // Execute re-link for each table
          const relinked: any = {};
          for (const table of relinkTables) {
            if (counts[table] === 0) continue;

            if (table === "contacts") {
              // Handle contact dedup: get existing primary emails
              const { data: primaryContacts } = await supabaseAdmin
                .from("contacts").select("email").eq("customer_id", primary_id);
              const existingEmails = new Set((primaryContacts || []).map((c: any) => c.email?.toLowerCase()).filter(Boolean));

              // Get duplicate's contacts
              const { data: dupContacts } = await supabaseAdmin
                .from("contacts").select("*").eq("customer_id", dupId);

              let moved = 0;
              for (const dc of (dupContacts || [])) {
                if (dc.email && existingEmails.has(dc.email.toLowerCase())) {
                  // Skip duplicate email contact — leave it (will be archived with parent)
                  continue;
                }
                await supabaseAdmin.from("contacts").update({ customer_id: primary_id }).eq("id", dc.id);
                moved++;
              }
              relinked.contacts = moved;
            } else {
              const { count: updCount } = await supabaseAdmin
                .from(table).update({ customer_id: primary_id } as any).eq("customer_id", dupId).select("*", { count: "exact", head: true });
              relinked[table] = updCount || counts[table];
            }
          }

          // If duplicate is a person-type customer, create a contact under primary
          if (dup.customer_type === "person" || (!dup.company_name && dup.first_name)) {
            const contactEmail = dup.email?.toLowerCase();
            // Check if contact with same email already exists under primary
            let alreadyExists = false;
            if (contactEmail) {
              const { data: existing } = await supabaseAdmin
                .from("contacts").select("id").eq("customer_id", primary_id).eq("email", contactEmail);
              if (existing && existing.length > 0) alreadyExists = true;
            }
            if (!alreadyExists) {
              await supabaseAdmin.from("contacts").insert({
                customer_id: primary_id,
                first_name: dup.first_name || dup.name?.split(" ")[0] || "Unknown",
                last_name: dup.last_name || dup.name?.split(" ").slice(1).join(" ") || null,
                email: dup.email || null,
                phone: dup.phone || dup.mobile || null,
                role: null,
                is_primary: false,
              });
            }
          }

          // Archive duplicate
          await supabaseAdmin.from("customers").update({
            status: "archived",
            merged_into_customer_id: primary_id,
            merged_at: new Date().toISOString(),
            merged_by: userId,
            merge_reason: reason || "Duplicate merged via Vizzy",
            updated_at: new Date().toISOString(),
          } as any).eq("id", dupId);

          // Log activity event
          await supabaseAdmin.from("activity_events").insert({
            company_id: companyId,
            entity_type: "customer_merge",
            entity_id: dupId,
            event_type: "customer_merged",
            description: `Merged customer "${dup.name}" into "${primary.name}"`,
            actor_id: userId,
            actor_type: "vizzy",
            source: "system",
            metadata: { primary_id, duplicate_id: dupId, relinked_counts: relinked, merge_reason: reason },
          }).catch(() => {});

          allResults.push({ duplicate_id: dupId, duplicate_name: dup.name, relinked_counts: relinked, archived: true });
        }

        if (dry_run) {
          result = { success: true, dry_run: true, primary: { id: primary.id, name: primary.name }, preview: allResults };
        } else {
          result = { success: true, dry_run: false, primary: { id: primary.id, name: primary.name }, merged: allResults, completed_at: new Date().toISOString() };
        }
        break;
      }

      case "bulk_fix_requests": {
        const { fix_requests } = params;
        if (!Array.isArray(fix_requests) || fix_requests.length === 0) {
          result = { success: false, error: "No fix requests provided" };
          break;
        }

        const { data: profile } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).single();
        const companyId = profile?.company_id;
        const actions: { id: string; action_taken: string }[] = [];

        for (const fr of fix_requests) {
          const area = (fr.affected_area || "").toLowerCase();
          try {
            if (area.includes("machine") || area.includes("cutter") || area.includes("bender")) {
              // Try to reset any errored machines to idle
              await supabaseAdmin.from("machines")
                .update({ status: "idle" })
                .eq("company_id", companyId)
                .eq("status", "error");
              actions.push({ id: fr.id, action_taken: "machine_reset" });
            } else if (area.includes("order") || area.includes("lead") || area.includes("delivery")) {
              // Log as human task for manual review
              await supabaseAdmin.from("human_tasks").insert({
                company_id: companyId,
                title: `Fix request: ${fr.description?.slice(0, 100)}`,
                description: `Auto-created from fix request. Area: ${fr.affected_area}. Original: ${fr.description}`,
                status: "open",
                priority: "high",
                created_by: userId,
              }).catch(() => {});
              actions.push({ id: fr.id, action_taken: "human_task_created" });
            } else {
              // Unknown area — create human task
              await supabaseAdmin.from("human_tasks").insert({
                company_id: companyId,
                title: `Unresolved fix request: ${fr.description?.slice(0, 80)}`,
                description: `Area: ${fr.affected_area || "unknown"}. Description: ${fr.description}`,
                status: "open",
                priority: "medium",
                created_by: userId,
              }).catch(() => {});
              actions.push({ id: fr.id, action_taken: "human_task_created" });
            }

            // Mark fix request as resolved
            await supabaseAdmin.from("vizzy_fix_requests")
              .update({ status: "resolved", resolved_at: new Date().toISOString() })
              .eq("id", fr.id);
          } catch (e) {
            actions.push({ id: fr.id, action_taken: `error: ${e.message}` });
          }
        }

        result = { success: true, processed: actions.length, actions };
        break;
      }

      case "create_task": {
        const { title, description, assigned_to_name, priority } = params;
        if (!title) throw new Error("Task title is required");

        const { data: profile } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).single();
        const companyId = profile?.company_id;

        // Resolve employee name to profile ID (fuzzy match)
        let assignedTo: string | null = null;
        if (assigned_to_name) {
          const { data: allProfiles } = await supabaseAdmin
            .from("profiles")
            .select("id, full_name, user_id")
            .eq("company_id", companyId)
            .not("full_name", "is", null);

          const nameNorm = assigned_to_name.toLowerCase().trim();
          const match = (allProfiles || []).find((p: any) => {
            const fn = (p.full_name || "").toLowerCase();
            return fn === nameNorm
              || fn.includes(nameNorm)
              || nameNorm.includes(fn.split(" ")[0])
              || fn.split(" ")[0] === nameNorm.split(" ")[0];
          });
          if (match) assignedTo = (match as any).id;
        }

        const { data, error } = await supabaseAdmin.from("human_tasks").insert({
          company_id: companyId,
          title,
          description: description || null,
          status: "open",
          priority: priority || "medium",
          created_by: userId,
          ...(assignedTo ? { assigned_to: assignedTo } : {}),
        } as any).select().single();
        if (error) throw error;

        result = {
          success: true,
          message: `Task created: "${title}"${assigned_to_name ? ` → assigned to ${assigned_to_name}` : ""}`,
          data,
        };
        break;
      }

      case "send_email": {
        const { to, subject, body, threadId, replyToMessageId } = params;
        if (!to || !subject || !body) throw new Error("to, subject, and body are required");

        // Call gmail-send edge function internally using the user's auth
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const response = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to,
            subject,
            body,
            threadId: threadId || undefined,
            replyToMessageId: replyToMessageId || undefined,
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Gmail send failed: ${errBody}`);
        }

        const sendResult = await response.json();
        result = {
          success: true,
          message: `Email sent to ${to}: "${subject}"`,
          data: sendResult,
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: corsHeaders });
    }

    // Log the action as an event
    const { data: profile } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).single();
    await supabaseAdmin.from("activity_events").insert({
      company_id: profile?.company_id,
      entity_type: "vizzy_action",
      entity_id: params?.id || crypto.randomUUID(),
      event_type: `vizzy_${action}`,
      description: `Vizzy executed: ${action}`,
      actor_id: userId,
      actor_type: "vizzy",
      metadata: { params },
      source: "system",
      dedupe_key: `vizzy_action:${action}:${params?.id || ""}:${new Date().toISOString().slice(0, 13)}`,
    }).catch(() => {});

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("vizzy-erp-action error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
