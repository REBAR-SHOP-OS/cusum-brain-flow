import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ userId, serviceClient: supabaseAdmin, body, req: rawReq }) => {
    const authHeader = rawReq.headers.get("Authorization") || "";

    const { action, params } = body;
    if (!action) {
      return new Response(JSON.stringify({ error: "action required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let result: any;

    try {
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
          try {
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
            });
          } catch (_e) { /* ignore */ }

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
              try {
                await supabaseAdmin.from("human_tasks").insert({
                  company_id: companyId,
                  title: `Fix request: ${fr.description?.slice(0, 100)}`,
                  description: `Auto-created from fix request. Area: ${fr.affected_area}. Original: ${fr.description}`,
                  status: "open",
                  priority: "high",
                  created_by: userId,
                });
              } catch (_e) { /* ignore */ }
              actions.push({ id: fr.id, action_taken: "human_task_created" });
            } else {
              // Unknown area — create human task
              try {
                await supabaseAdmin.from("human_tasks").insert({
                  company_id: companyId,
                  title: `Unresolved fix request: ${fr.description?.slice(0, 80)}`,
                  description: `Area: ${fr.affected_area || "unknown"}. Description: ${fr.description}`,
                  status: "open",
                  priority: "medium",
                  created_by: userId,
                });
              } catch (_e) { /* ignore */ }
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

      case "batch_create_tasks": {
        const { tasks: taskList } = params;
        if (!Array.isArray(taskList) || taskList.length === 0) {
          throw new Error("tasks array is required and must not be empty");
        }

        const { data: profile } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).single();
        const companyId = profile?.company_id;

        // Load all profiles once for fuzzy matching
        const { data: allProfiles } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, user_id")
          .eq("company_id", companyId)
          .not("full_name", "is", null);

        const resolveProfile = (name: string): string | null => {
          if (!name) return null;
          const nameNorm = name.toLowerCase().trim();
          const match = (allProfiles || []).find((p: any) => {
            const fn = (p.full_name || "").toLowerCase();
            return fn === nameNorm
              || fn.includes(nameNorm)
              || nameNorm.includes(fn.split(" ")[0])
              || fn.split(" ")[0] === nameNorm.split(" ")[0];
          });
          return match ? (match as any).id : null;
        };

        const created: string[] = [];
        const failed: string[] = [];

        for (const task of taskList) {
          try {
            const assignedTo = task.assigned_to_name ? resolveProfile(task.assigned_to_name) : null;
            const { error: insertErr } = await supabaseAdmin.from("human_tasks").insert({
              company_id: companyId,
              title: task.title,
              description: task.description || null,
              status: "open",
              priority: task.priority || "medium",
              category: task.category || null,
              created_by: userId,
              ...(assignedTo ? { assigned_to: assignedTo } : {}),
            } as any);
            if (insertErr) throw insertErr;
            created.push(task.title);
          } catch (e) {
            failed.push(`${task.title}: ${e.message}`);
          }
        }

        result = {
          success: true,
          message: `Created ${created.length} tasks${failed.length > 0 ? `, ${failed.length} failed` : ""}`,
          created_count: created.length,
          failed_count: failed.length,
          created_titles: created,
          failed_details: failed,
        };
        break;
      }

      case "update_task_status": {
        const { task_id, status: newStatus, reassign_to_name } = params;
        if (!task_id || !newStatus) throw new Error("task_id and status are required");

        const validStatuses = ["open", "acted", "dismissed", "snoozed"];
        if (!validStatuses.includes(newStatus)) {
          throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
        }

        const updatePayload: any = { status: newStatus };
        if (newStatus === "acted" || newStatus === "dismissed") {
          updatePayload.resolved_at = new Date().toISOString();
        }

        if (reassign_to_name) {
          const { data: prof } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).single();
          const { data: allProfiles } = await supabaseAdmin
            .from("profiles")
            .select("id, full_name")
            .eq("company_id", prof?.company_id)
            .not("full_name", "is", null);

          const nameNorm = reassign_to_name.toLowerCase().trim();
          const match = (allProfiles || []).find((p: any) => {
            const fn = (p.full_name || "").toLowerCase();
            return fn === nameNorm || fn.includes(nameNorm) || fn.split(" ")[0] === nameNorm.split(" ")[0];
          });
          if (match) updatePayload.assigned_to = (match as any).id;
        }

        const { data, error } = await supabaseAdmin
          .from("human_tasks")
          .update(updatePayload)
          .eq("id", task_id)
          .select()
          .single();
        if (error) throw error;

        result = {
          success: true,
          message: `Task ${task_id} updated to ${newStatus}${reassign_to_name ? ` and reassigned to ${reassign_to_name}` : ""}`,
          data,
        };
        break;
      }

      // ─── RingCentral Telephony Tools ───

      case "rc_send_sms": {
        const { phone, message, contact_name } = params;
        if (!phone || !message) throw new Error("phone and message are required");
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const resp = await fetch(`${supabaseUrl}/functions/v1/ringcentral-action`, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ type: "ringcentral_sms", phone, message, contact_name }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "SMS send failed");
        result = { success: true, message: `SMS sent to ${contact_name || phone}: "${message.slice(0, 80)}..."`, data };
        break;
      }

      case "rc_make_call": {
        const { phone, contact_name } = params;
        if (!phone) throw new Error("phone is required");
        // Return browser_action so the frontend places the call via WebRTC widget
        result = {
          success: true,
          message: `Placing WebRTC call to ${contact_name || phone}...`,
          browser_action: "webrtc_call",
          phone,
          contact_name: contact_name || "",
        };
        break;
      }

      case "rc_send_fax": {
        const { fax_number, cover_page_text } = params;
        if (!fax_number) throw new Error("fax_number is required");
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const formData = new FormData();
        formData.append("fax_number", fax_number);
        if (cover_page_text) formData.append("cover_page_text", cover_page_text);
        const resp = await fetch(`${supabaseUrl}/functions/v1/ringcentral-fax-send`, {
          method: "POST",
          headers: { Authorization: authHeader },
          body: formData,
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Fax send failed");
        result = { success: true, message: `Fax sent to ${fax_number}`, data };
        break;
      }

      case "rc_create_meeting": {
        const { meeting_name, meeting_type } = params;
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const resp = await fetch(`${supabaseUrl}/functions/v1/ringcentral-video`, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", meetingName: meeting_name || "Team Meeting", meetingType: meeting_type || "video" }),
        });
        const data = await resp.json();
        if (!data.success) throw new Error(data.error || "Meeting creation failed");
        result = { success: true, message: `Meeting created: ${data.joinUrl}`, data };
        break;
      }

      case "rc_get_call_analytics": {
        const { days_back } = params;
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const resp = await fetch(`${supabaseUrl}/functions/v1/ringcentral-call-analytics`, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ daysBack: days_back || 30 }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Analytics fetch failed");
        result = { success: true, message: `Call analytics for last ${days_back || 30} days`, data };
        break;
      }

      case "rc_get_active_calls": {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const resp = await fetch(`${supabaseUrl}/functions/v1/ringcentral-active-calls`, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await resp.json();
        result = { success: true, message: `${(data.activeCalls || []).length} active call(s)`, data };
        break;
      }

      // ─── Email Reading Tools ───

      case "read_employee_emails": {
        const { employee_name_or_email, limit: emailLimit, date: emailDate } = params;
        if (!employee_name_or_email) throw new Error("employee_name_or_email is required");

        const { data: prof } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).single();
        const companyId = prof?.company_id;

        // Resolve employee name/email to their email address
        const { data: allProfiles } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, user_id")
          .eq("company_id", companyId)
          .not("full_name", "is", null);

        const searchTerm = employee_name_or_email.toLowerCase().trim();
        const matchedProfile = (allProfiles || []).find((p: any) => {
          const fn = (p.full_name || "").toLowerCase();
          const em = (p.email || "").toLowerCase();
          return fn === searchTerm
            || fn.includes(searchTerm)
            || searchTerm.includes(fn.split(" ")[0])
            || fn.split(" ")[0] === searchTerm.split(" ")[0]
            || em === searchTerm
            || em.startsWith(searchTerm.split("@")[0]);
        });

        if (!matchedProfile) {
          result = { success: false, error: `No employee found matching "${employee_name_or_email}"` };
          break;
        }

        const employeeEmail = (matchedProfile as any).email;
        const employeeName = (matchedProfile as any).full_name;

        // Build date filter
        let dateFilter: string;
        if (emailDate) {
          dateFilter = new Date(emailDate).toISOString().slice(0, 10);
        } else {
          dateFilter = new Date().toISOString().slice(0, 10);
        }
        const dayStart = `${dateFilter}T00:00:00.000Z`;
        const dayEnd = `${dateFilter}T23:59:59.999Z`;

        // Query communications for this employee (both sent and received)
        const { data: emails, error: emailErr } = await supabaseAdmin
          .from("communications")
          .select("id, subject, body_preview, from_address, to_address, direction, received_at, thread_id, source, ai_category, ai_action_required")
          .eq("company_id", companyId)
          .gte("received_at", dayStart)
          .lte("received_at", dayEnd)
          .or(`from_address.ilike.%${employeeEmail}%,to_address.ilike.%${employeeEmail}%`)
          .order("received_at", { ascending: false })
          .limit(emailLimit || 50);

        if (emailErr) throw emailErr;

        result = {
          success: true,
          employee: employeeName,
          email: employeeEmail,
          date: dateFilter,
          total: (emails || []).length,
          sent: (emails || []).filter((e: any) => e.direction === "outbound").length,
          received: (emails || []).filter((e: any) => e.direction === "inbound").length,
          emails: (emails || []).map((e: any) => ({
            id: e.id,
            subject: e.subject || "(no subject)",
            body_preview: (e.body_preview || "").slice(0, 800),
            from: e.from_address,
            to: e.to_address,
            direction: e.direction,
            time: e.received_at,
            thread_id: e.thread_id,
            source: e.source,
            category: e.ai_category,
            action_required: e.ai_action_required,
          })),
        };
        break;
      }

      case "read_email_thread": {
        const { thread_id: threadId, communication_id: commId } = params;
        if (!threadId && !commId) throw new Error("thread_id or communication_id is required");

        const { data: prof } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).single();
        const companyId = prof?.company_id;

        let query = supabaseAdmin
          .from("communications")
          .select("id, subject, body_preview, from_address, to_address, direction, received_at, thread_id, gmail_message_id, source")
          .eq("company_id", companyId)
          .order("received_at", { ascending: true })
          .limit(30);

        if (threadId) {
          query = query.eq("thread_id", threadId);
        } else {
          query = query.eq("id", commId);
        }

        const { data: threadEmails, error: threadErr } = await query;
        if (threadErr) throw threadErr;

        // If we have gmail_message_id, try to fetch full body via Gmail API
        const enrichedEmails = [];
        for (const email of (threadEmails || [])) {
          const emailData: any = {
            id: email.id,
            subject: email.subject || "(no subject)",
            body_preview: (email.body_preview || "").slice(0, 2000),
            from: email.from_address,
            to: email.to_address,
            direction: email.direction,
            time: email.received_at,
            source: email.source,
          };

          // Try to get full body from Gmail if available
          if (email.gmail_message_id && email.source === "gmail") {
            try {
              const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
              const gmailResp = await fetch(`${supabaseUrl}/functions/v1/gmail-sync`, {
                method: "POST",
                headers: { Authorization: authHeader, "Content-Type": "application/json" },
                body: JSON.stringify({ messageId: email.gmail_message_id, fetchFull: true }),
              });
              if (gmailResp.ok) {
                const gmailData = await gmailResp.json();
                if (gmailData?.messages?.[0]?.body) {
                  emailData.full_body = gmailData.messages[0].body;
                }
              }
            } catch (_e) {
              // Silent fail — body_preview is still available
            }
          }

          enrichedEmails.push(emailData);
        }

        result = {
          success: true,
          thread_id: threadId || null,
          total_messages: enrichedEmails.length,
          messages: enrichedEmails,
        };
        break;
      }

      case "rc_get_team_presence": {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const resp = await fetch(`${supabaseUrl}/functions/v1/ringcentral-presence`, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await resp.json();
        result = { success: true, message: `Team presence: ${(data.presenceData || []).length} user(s)`, data };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: corsHeaders });
    }

    // Log the action as an event
    const { data: profile } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).single();
    try {
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
      });
    } catch (_e) { /* ignore */ }

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
  }, { functionName: "vizzy-erp-action", wrapResult: false })
);
