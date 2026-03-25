import { corsHeaders, json } from "../_shared/auth.ts";
import { isOdooEnabled } from "../_shared/featureFlags.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleRequest } from "../_shared/requestHandler.ts";
import {
  STAGE_MAP, TERMINAL_STAGES, ACTIVE_STAGES,
  validateOdooLead, persistValidationWarnings, summarizeWarnings,
  type ValidationWarning,
} from "../_shared/odoo-validation.ts";

const FIELDS = [
  "id", "name", "stage_id", "email_from", "phone", "contact_name",
  "user_id", "probability", "expected_revenue", "type", "partner_name",
  "city", "create_date", "write_date", "priority",
  "date_deadline",
];

/** Map Odoo priority (0=Normal,1=Low,2=High,3=Very High) to our priority */
function mapOdooPriority(raw: unknown): "low" | "medium" | "high" {
  const p = String(raw ?? "0");
  if (p === "3" || p === "2") return "high";
  if (p === "1") return "low";
  return "medium"; // 0 = Normal → medium
}

async function odooRpc(url: string, db: string, apiKey: string, model: string, method: string, args: unknown[]) {
  const rpcArgs = [db, 2, apiKey, model, method, ...args];
  console.log("RPC args structure:", JSON.stringify(rpcArgs.map((a, i) => i < 3 ? '***' : a)));
  const res = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "call",
      params: {
        service: "object", method: "execute_kw",
        args: rpcArgs,
      },
    }),
  });
  const data = await res.json();
  if (data.error) {
    console.error("Odoo RPC error detail:", JSON.stringify(data.error));
    throw new Error(data.error.data?.message || data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

/** Insert a lead_event if dedupe_key doesn't already exist */
async function insertLeadEvent(
  serviceClient: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  leadId: string,
  eventType: string,
  payload: Record<string, unknown>,
  sourceSystem = "odoo_sync"
) {
  const dedupeKey = `${leadId}:${eventType}:${JSON.stringify(payload)}`;
  await serviceClient.from("lead_events").upsert({
    lead_id: leadId,
    event_type: eventType,
    payload,
    source_system: sourceSystem,
    dedupe_key: dedupeKey.slice(0, 500),
  }, { onConflict: "dedupe_key" });
}

/** Snapshot a lead record before deletion for rollback */
async function logDedupRollback(
  serviceClient: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  deletedId: string,
  survivorId: string,
  snapshot: Record<string, unknown>
) {
  await serviceClient.from("dedup_rollback_log").insert({
    deleted_id: deletedId,
    survivor_id: survivorId,
    pre_merge_snapshot: snapshot,
  });
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { serviceClient, body: reqBody } = ctx;

    // ODOO_ENABLED feature flag guard
    if (!isOdooEnabled()) {
      console.warn("ODOO_ENABLED guard: flag resolved to false");
      return json({ error: "Odoo integration is disabled", disabled: true }, 200);
    }

    // Parse mode from request body
    let mode = "incremental";
    let singleOdooId: string | null = null;
    if (reqBody?.mode === "full") mode = "full";
    if (reqBody?.mode === "single" && reqBody?.odoo_id) {
      mode = "single";
      singleOdooId = String(reqBody.odoo_id);
    }

    const odooUrl = Deno.env.get("ODOO_URL")!.trim();
    const odooKey = Deno.env.get("ODOO_API_KEY")!;
    const odooDB = Deno.env.get("ODOO_DATABASE")!;

    // ── SINGLE-LEAD MODE: fast path for on-open refresh ──
    if (mode === "single" && singleOdooId) {
      console.log(`Single-lead refresh for odoo_id=${singleOdooId}`);
      const leads = await odooRpc(odooUrl, odooDB, odooKey, "crm.lead", "search_read", [
        [[["type", "=", "opportunity"], ["id", "=", Number(singleOdooId)]]],
        { fields: FIELDS },
      ]);
      if (!leads || leads.length === 0) {
        return json({ mode: "single", odoo_id: singleOdooId, found: false, message: "Lead not found in Odoo" });
      }
      const ol = leads[0];
      const stageName = Array.isArray(ol.stage_id) ? ol.stage_id[1] : String(ol.stage_id || "");
      const erpStage = STAGE_MAP[stageName] || "new";
      const odooCreatedAt = ol.create_date ? new Date(String(ol.create_date).replace(" ", "T") + (String(ol.create_date).includes("+") ? "" : "Z")).toISOString() : null;
      const odooUpdatedAt = ol.write_date ? new Date(String(ol.write_date).replace(" ", "T") + (String(ol.write_date).includes("+") ? "" : "Z")).toISOString() : null;
      const now = new Date().toISOString();
      const salesperson = Array.isArray(ol.user_id) ? ol.user_id[1] : null;
      const normalizedProb = erpStage === "won" ? 100 : erpStage === "lost" || erpStage === "loss" ? 0 : Math.round(Number(ol.probability) || 0);

      // Find local lead
      const { data: localLeads } = await serviceClient
        .from("leads").select("id, metadata, stage").eq("source", "odoo_sync");
      const localLead = (localLeads || []).find((l: any) => String((l.metadata as any)?.odoo_id) === singleOdooId);
      if (!localLead) {
        return json({ mode: "single", odoo_id: singleOdooId, found: true, local: false, message: "Odoo lead exists but not mirrored locally yet" });
      }

      const prevStage = localLead.stage;
      const metadata = {
        ...((localLead.metadata as Record<string, unknown>) || {}),
        odoo_stage: stageName,
        odoo_salesperson: salesperson,
        odoo_email: ol.email_from || null,
        odoo_phone: ol.phone || null,
        odoo_contact: ol.contact_name || null,
        odoo_probability: ol.probability || 0,
        odoo_revenue: ol.expected_revenue || 0,
        odoo_partner: ol.partner_name || null,
        odoo_city: ol.city || null,
        odoo_priority: ol.priority || "0",
        odoo_date_deadline: ol.date_deadline || null,
        odoo_created_at: odooCreatedAt,
        odoo_updated_at: odooUpdatedAt,
        synced_at: now,
      };

      await serviceClient.from("leads").update({
        title: ol.name || "Untitled",
        stage: erpStage,
        probability: normalizedProb,
        expected_value: Number(ol.expected_revenue) || 0,
        expected_close_date: ol.date_deadline || null,
        priority: mapOdooPriority(ol.priority),
        metadata,
        updated_at: now,
        odoo_created_at: odooCreatedAt,
        odoo_updated_at: odooUpdatedAt,
      }).eq("id", localLead.id);

      // Log stage change if different
      if (prevStage && prevStage !== erpStage) {
        await insertLeadEvent(serviceClient, localLead.id, "stage_changed", {
          from: prevStage, to: erpStage, odoo_stage: stageName, source: "single_refresh",
        });
      }

      return json({ mode: "single", odoo_id: singleOdooId, found: true, updated: true, stage: erpStage, prev_stage: prevStage });
    }

    // Build domain: full mode fetches ALL, incremental fetches last 5 days
    const domain: unknown[][] = [["type", "=", "opportunity"]];
    if (mode !== "full") {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const cutoff = fiveDaysAgo.toISOString().replace("T", " ").slice(0, 19);
      domain.push(["write_date", ">=", cutoff]);
      console.log("Incremental sync: write_date >=", cutoff);
    } else {
      console.log("Full sync: fetching ALL opportunities");
    }

    // Get total count first for transparency and pagination guard
    const totalCount = await odooRpc(odooUrl, odooDB, odooKey, "crm.lead", "search_count", [
      [domain],
    ]);
    console.log(`Odoo reports ${totalCount} total opportunities`);

    // Paginated fetch — batch=500 to stay well within Odoo server caps
    const BATCH = 500;
    const leads: Record<string, unknown>[] = [];
    let offset = 0;
    while (offset < totalCount) {
      const batch = await odooRpc(odooUrl, odooDB, odooKey, "crm.lead", "search_read", [
        [domain],
        { fields: FIELDS, limit: BATCH, offset },
      ]);
      if (!batch || batch.length === 0) break;
      leads.push(...batch);
      offset += batch.length;
      console.log(`Fetched ${leads.length} / ${totalCount} opportunities`);
      if (batch.length < BATCH) break; // last page
    }

    console.log(`Fetched ${leads.length} opportunities from Odoo (expected ${totalCount})`);

    // Get company_id from first existing odoo_sync lead
    const { data: sampleLead } = await serviceClient
      .from("leads")
      .select("company_id")
      .eq("source", "odoo_sync")
      .limit(1)
      .single();

    const companyId = sampleLead?.company_id || "a0000000-0000-0000-0000-000000000001";
    const syncRunAt = new Date().toISOString();

    // Load ALL existing odoo_sync leads with pagination (Supabase caps at 1000/query)
    const allExisting: Array<{ id: string; metadata: unknown; stage: string; customer_id: string | null }> = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await serviceClient
        .from("leads")
        .select("id, metadata, stage, customer_id")
        .eq("source", "odoo_sync")
        .range(from, from + PAGE - 1);
      if (error) throw new Error("Failed to load existing leads: " + error.message);
      if (!data || data.length === 0) break;
      allExisting.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    console.log(`Loaded ${allExisting.length} existing odoo_sync leads for dedup`);

    // Collect all validation warnings across the sync
    const allValidationWarnings: ValidationWarning[] = [];
    // Build lead_id map for validation log persistence
    const leadIdByOdooId = new Map<string, string>();

    // Build map keeping only the most-recently-synced record per odoo_id
    const odooIdMap = new Map<string, { id: string; syncedAt: string; stage: string; customer_id: string | null }>();
    const victimIds: string[] = [];
    const victimSnapshots: Array<{ id: string; survivorId: string; snapshot: Record<string, unknown> }> = [];

    for (const l of allExisting) {
      const meta = l.metadata as Record<string, unknown> | null;
      const oid = String(meta?.odoo_id ?? "");
      if (!oid) continue;

      const syncedAt = (meta?.synced_at as string) || "";
      const existing = odooIdMap.get(oid);

      if (!existing) {
        odooIdMap.set(oid, { id: l.id, syncedAt, stage: l.stage, customer_id: l.customer_id });
      } else if (syncedAt > existing.syncedAt) {
        victimIds.push(existing.id);
        victimSnapshots.push({ id: existing.id, survivorId: l.id, snapshot: l as unknown as Record<string, unknown> });
        odooIdMap.set(oid, { id: l.id, syncedAt, stage: l.stage, customer_id: l.customer_id });
      } else {
        victimIds.push(l.id);
        victimSnapshots.push({ id: l.id, survivorId: existing.id, snapshot: l as unknown as Record<string, unknown> });
      }
    }

    // Log rollback snapshots before deleting duplicates
    for (const v of victimSnapshots) {
      await logDedupRollback(serviceClient, v.id, v.survivorId, v.snapshot);
    }

    // Clean up any duplicates found during map loading
    if (victimIds.length > 0) {
      console.log(`Dedup: deleting ${victimIds.length} duplicate leads (rollback logged)`);
      // Log duplicate validation warnings
      for (const v of victimSnapshots) {
        const meta = (allExisting.find(l => l.id === v.id)?.metadata as Record<string, unknown>) || {};
        const odooId = (meta.odoo_id as string) || "unknown";
        allValidationWarnings.push({
          odoo_id: odooId, severity: "warning", validation_type: "duplicate_detected",
          message: `Duplicate ERP lead deleted (survivor: ${v.survivorId})`,
          auto_fixed: true, fix_applied: "Duplicate removed, rollback logged",
        });
      }
      for (let i = 0; i < victimIds.length; i += 50) {
        const batch = victimIds.slice(i, i + 50);
        await serviceClient.from("leads").delete().in("id", batch);
      }
    }

    let created = 0, updated = 0, skipped = 0, errors = 0;

    // ═══ BATCH OPTIMIZATION: Pre-load customers & contacts in bulk ═══

    // 1. Load ALL customers for this company into memory
    const customerMap = new Map<string, string>(); // name_lower → id
    let custFrom = 0;
    while (true) {
      const { data: custBatch } = await serviceClient
        .from("customers")
        .select("id, name")
        .eq("company_id", companyId)
        .range(custFrom, custFrom + 999);
      if (!custBatch || custBatch.length === 0) break;
      for (const c of custBatch) {
        if (c.name) customerMap.set(c.name.toLowerCase(), c.id);
      }
      if (custBatch.length < 1000) break;
      custFrom += 1000;
    }
    console.log(`Pre-loaded ${customerMap.size} customers into memory`);

    // 2. Load ALL contacts for this company into memory
    const contactByEmail = new Map<string, string>(); // "custId:email_lower" → contact_id
    const contactByPhone = new Map<string, string>(); // "custId:phone" → contact_id
    let contFrom = 0;
    while (true) {
      const { data: contBatch } = await serviceClient
        .from("contacts")
        .select("id, customer_id, email, phone")
        .eq("company_id", companyId)
        .range(contFrom, contFrom + 999);
      if (!contBatch || contBatch.length === 0) break;
      for (const c of contBatch) {
        if (c.customer_id && c.email) contactByEmail.set(`${c.customer_id}:${c.email.toLowerCase()}`, c.id);
        if (c.customer_id && c.phone) contactByPhone.set(`${c.customer_id}:${c.phone}`, c.id);
      }
      if (contBatch.length < 1000) break;
      contFrom += 1000;
    }
    console.log(`Pre-loaded ${contactByEmail.size + contactByPhone.size} contact mappings`);

    // ═══ FIRST PASS: Identify new customers needed ═══
    const newCustomerNames = new Set<string>();
    for (const ol of leads) {
      const customerName = String(ol.partner_name || ol.contact_name || "Unknown");
      if (!customerMap.has(customerName.toLowerCase())) {
        newCustomerNames.add(customerName);
      }
    }

    // 3. Batch-insert new customers (100 at a time)
    if (newCustomerNames.size > 0) {
      const newCustArr = Array.from(newCustomerNames);
      console.log(`Batch-inserting ${newCustArr.length} new customers`);
      for (let i = 0; i < newCustArr.length; i += 100) {
        const batch = newCustArr.slice(i, i + 100).map(name => ({
          name,
          company_id: companyId,
          company_name: name,
        }));
        const { data: inserted } = await serviceClient
          .from("customers")
          .upsert(batch, { onConflict: "name,company_id", ignoreDuplicates: true })
          .select("id, name");
        if (inserted) {
          for (const c of inserted) {
            if (c.name) customerMap.set(c.name.toLowerCase(), c.id);
          }
        }
        // Re-fetch any that were duplicates (upsert with ignoreDuplicates won't return them)
        const missingNames = batch.filter(b => !customerMap.has(b.name.toLowerCase()));
        if (missingNames.length > 0) {
          for (const mn of missingNames) {
            const { data: existing } = await serviceClient
              .from("customers")
              .select("id")
              .ilike("name", mn.name)
              .eq("company_id", companyId)
              .limit(1)
              .single();
            if (existing) customerMap.set(mn.name.toLowerCase(), existing.id);
          }
        }
      }
    }

    // ═══ SECOND PASS: Build all lead payloads + collect new contacts ═══
    const leadUpdates: Array<{ id: string; payload: Record<string, unknown> }> = [];
    const leadInserts: Array<Record<string, unknown>> = [];
    const leadEvents: Array<{ lead_id: string; event_type: string; payload: Record<string, unknown> }> = [];
    const newContacts: Array<{ customer_id: string; company_id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null; _odoo_id: string }> = [];

    for (const ol of leads) {
      try {
        const odooId = String(ol.id);
        const stageName = Array.isArray(ol.stage_id) ? ol.stage_id[1] : String(ol.stage_id || "");
        const erpStage = STAGE_MAP[stageName] || "new";
        const salesperson = Array.isArray(ol.user_id) ? ol.user_id[1] : null;

        const existingEntry = odooIdMap.get(odooId);
        const previousStage = existingEntry?.stage || null;

        // === PRE-SYNC VALIDATION ===
        const leadWarnings = validateOdooLead(ol, erpStage, previousStage);
        allValidationWarnings.push(...leadWarnings);

        // Parse Odoo origin dates
        const odooCreatedAt = ol.create_date ? new Date(String(ol.create_date).replace(" ", "T") + (String(ol.create_date).includes("+") ? "" : "Z")).toISOString() : null;
        const odooUpdatedAt = ol.write_date ? new Date(String(ol.write_date).replace(" ", "T") + (String(ol.write_date).includes("+") ? "" : "Z")).toISOString() : null;
        const now = new Date().toISOString();

        const metadata: Record<string, unknown> = {
          odoo_id: odooId,
          odoo_stage: stageName,
          odoo_salesperson: salesperson,
          odoo_email: ol.email_from || null,
          odoo_phone: ol.phone || null,
          odoo_contact: ol.contact_name || null,
          odoo_probability: ol.probability || 0,
          odoo_revenue: ol.expected_revenue || 0,
          odoo_partner: ol.partner_name || null,
          odoo_city: ol.city || null,
          odoo_priority: ol.priority || "0",
          odoo_type: ol.type || null,
          odoo_date_deadline: ol.date_deadline || null,
          odoo_created_at: odooCreatedAt,
          odoo_updated_at: odooUpdatedAt,
          synced_at: now,
          validation_warnings: leadWarnings.length,
        };

        const dateDeadline = ol.date_deadline || null;
        const existingId = existingEntry?.id;
        const normalizedProb = erpStage === "won" ? 100 : erpStage === "lost" || erpStage === "loss" ? 0 : Math.round(Number(ol.probability) || 0);

        // Resolve customer from pre-loaded map
        const customerName = String(ol.partner_name || ol.contact_name || "Unknown");
        const customerId = customerMap.get(customerName.toLowerCase()) || null;

        // Resolve contact from pre-loaded map
        let contactId: string | null = null;
        if (customerId) {
          if (ol.email_from) {
            contactId = contactByEmail.get(`${customerId}:${String(ol.email_from).toLowerCase()}`) || null;
          }
          if (!contactId && ol.phone) {
            contactId = contactByPhone.get(`${customerId}:${String(ol.phone)}`) || null;
          }
          // Queue new contact creation if not found
          if (!contactId && (ol.email_from || ol.phone)) {
            const contactName = String(ol.contact_name || ol.partner_name || "Unknown");
            const nameParts = contactName.trim().split(/\s+/);
            newContacts.push({
              customer_id: customerId,
              company_id: companyId,
              first_name: nameParts[0] || "Unknown",
              last_name: nameParts.slice(1).join(" ") || null,
              email: ol.email_from ? String(ol.email_from) : null,
              phone: ol.phone ? String(ol.phone) : null,
              _odoo_id: odooId,
            });
          }
        }

        const lastTouchedAt = odooUpdatedAt && odooUpdatedAt > now ? odooUpdatedAt : now;

        if (existingId) {
          leadIdByOdooId.set(odooId, existingId);

          // Detect stage change
          if (previousStage && previousStage !== erpStage) {
            leadEvents.push({ lead_id: existingId, event_type: "stage_changed", payload: {
              from: previousStage, to: erpStage, odoo_stage: stageName,
            }});
          }

          // Detect value change
          const prevMeta = (allExisting.find(l => l.id === existingId)?.metadata as Record<string, unknown>) || {};
          const prevRevenue = Number(prevMeta.odoo_revenue) || 0;
          const newRevenue = Number(ol.expected_revenue) || 0;
          if (prevRevenue !== newRevenue) {
            leadEvents.push({ lead_id: existingId, event_type: "value_changed", payload: {
              from: prevRevenue, to: newRevenue,
            }});
          }

          const updatePayload: Record<string, unknown> = {
            title: ol.name || "Untitled",
            stage: erpStage,
            probability: normalizedProb,
            expected_value: Number(ol.expected_revenue) || 0,
            expected_close_date: dateDeadline,
            priority: mapOdooPriority(ol.priority),
            metadata,
            updated_at: now,
            odoo_created_at: odooCreatedAt,
            odoo_updated_at: odooUpdatedAt,
            last_touched_at: lastTouchedAt,
          };

          if (customerId && ACTIVE_STAGES.has(erpStage)) {
            updatePayload.customer_id = customerId;
          }
          if (contactId) {
            updatePayload.contact_id = contactId;
          }

          leadUpdates.push({ id: existingId, payload: updatePayload });
        } else {
          const insertPayload: Record<string, unknown> = {
            title: ol.name || "Untitled",
            stage: erpStage,
            probability: normalizedProb,
            expected_value: Number(ol.expected_revenue) || 0,
            expected_close_date: dateDeadline,
            source: "odoo_sync",
            customer_id: customerId,
            contact_id: contactId,
            company_id: companyId,
            metadata,
            priority: mapOdooPriority(ol.priority),
            odoo_created_at: odooCreatedAt,
            odoo_updated_at: odooUpdatedAt,
            last_touched_at: lastTouchedAt,
            _odoo_id: odooId, // temp marker for post-insert event linking
          };
          leadInserts.push(insertPayload);
        }
      } catch (e) {
        console.error("Lead prep error:", e);
        errors++;
      }
    }

    // ═══ BATCH: Insert new contacts (100 at a time) ═══
    if (newContacts.length > 0) {
      console.log(`Batch-inserting ${newContacts.length} new contacts`);
      for (let i = 0; i < newContacts.length; i += 100) {
        const batch = newContacts.slice(i, i + 100);
        // Strip _odoo_id before inserting
        const insertBatch = batch.map(({ _odoo_id, ...rest }) => rest);
        const { data: inserted } = await serviceClient
          .from("contacts")
          .insert(insertBatch)
          .select("id, customer_id, email, phone");
        if (inserted) {
          for (const c of inserted) {
            if (c.customer_id && c.email) contactByEmail.set(`${c.customer_id}:${c.email.toLowerCase()}`, c.id);
            if (c.customer_id && c.phone) contactByPhone.set(`${c.customer_id}:${c.phone}`, c.id);
          }
          // Update lead payloads with newly created contact IDs
          for (const b of batch) {
            const match = inserted.find((ins: any) =>
              (b.email && ins.email?.toLowerCase() === b.email.toLowerCase() && ins.customer_id === b.customer_id) ||
              (b.phone && ins.phone === b.phone && ins.customer_id === b.customer_id)
            );
            if (match) {
              // Update corresponding lead update or insert payload
              const lu = leadUpdates.find(u => {
                const meta = u.payload.metadata as Record<string, unknown>;
                return meta?.odoo_id === b._odoo_id;
              });
              if (lu) lu.payload.contact_id = match.id;
              const li = leadInserts.find(ins => (ins as any)._odoo_id === b._odoo_id);
              if (li) li.contact_id = match.id;
            }
          }
        }
      }
    }

    // ═══ BATCH: Update existing leads (50 at a time) ═══
    console.log(`Batch-updating ${leadUpdates.length} existing leads`);
    for (let i = 0; i < leadUpdates.length; i += 50) {
      const batch = leadUpdates.slice(i, i + 50);
      const results = await Promise.all(
        batch.map(({ id, payload }) =>
          serviceClient.from("leads").update(payload).eq("id", id)
        )
      );
      for (const r of results) {
        if (r.error) { console.error("Batch update error:", r.error); errors++; }
        else updated++;
      }
    }

    // ═══ BATCH: Insert new leads (50 at a time) ═══
    console.log(`Batch-inserting ${leadInserts.length} new leads`);
    for (let i = 0; i < leadInserts.length; i += 50) {
      const batch = leadInserts.slice(i, i + 50);
      // Strip temp _odoo_id marker and save mapping
      const odooIds = batch.map(b => (b as any)._odoo_id as string);
      const cleanBatch = batch.map(({ _odoo_id, ...rest }) => rest);

      const { data: inserted, error: batchErr } = await serviceClient
        .from("leads")
        .insert(cleanBatch)
        .select("id, metadata");

      if (batchErr) {
        console.error("Batch insert error:", batchErr);
        // Fallback: insert one-by-one for this batch
        for (let j = 0; j < cleanBatch.length; j++) {
          const { data: single, error: singleErr } = await serviceClient
            .from("leads").insert(cleanBatch[j]).select("id").single();
          if (singleErr) {
            if (singleErr.code === "23505") {
              console.warn(`Duplicate caught for odoo_id ${odooIds[j]}, skipping`);
              skipped++;
            } else {
              console.error(`Insert error for odoo_id ${odooIds[j]}:`, singleErr);
              errors++;
            }
          } else if (single) {
            created++;
            leadIdByOdooId.set(odooIds[j], single.id);
            leadEvents.push({ lead_id: single.id, event_type: "stage_changed", payload: {
              from: null, to: cleanBatch[j].stage, odoo_stage: (cleanBatch[j].metadata as any)?.odoo_stage,
            }});
          }
        }
      } else if (inserted) {
        created += inserted.length;
        for (const ins of inserted) {
          const meta = ins.metadata as Record<string, unknown>;
          const oid = String(meta?.odoo_id || "");
          if (oid) {
            leadIdByOdooId.set(oid, ins.id);
            leadEvents.push({ lead_id: ins.id, event_type: "stage_changed", payload: {
              from: null, to: (meta as any)?.odoo_stage ? STAGE_MAP[(meta as any).odoo_stage] || "new" : "new",
              odoo_stage: (meta as any)?.odoo_stage,
            }});
          }
        }
      }
    }

    // ═══ BATCH: Insert lead events (100 at a time via upsert) ═══
    console.log(`Batch-inserting ${leadEvents.length} lead events`);
    for (let i = 0; i < leadEvents.length; i += 100) {
      const batch = leadEvents.slice(i, i + 100).map(e => ({
        lead_id: e.lead_id,
        event_type: e.event_type,
        payload: e.payload,
        source_system: "odoo_sync",
        dedupe_key: `${e.lead_id}:${e.event_type}:${JSON.stringify(e.payload)}`.slice(0, 500),
      }));
      await serviceClient.from("lead_events").upsert(batch, { onConflict: "dedupe_key" });
    }

    console.log(`Processing complete: created=${created} updated=${updated} skipped=${skipped} errors=${errors}`);

    // === Reconciliation: check stale ERP leads not in this fetch ===
    const fetchedOdooIds = new Set(leads.map((ol: Record<string, unknown>) => String(ol.id)));
    const TERMINAL_STAGES = new Set(["won", "lost", "loss", "merged", "archived_orphan"]);

    // Find stale leads (have odoo_id but not in Odoo anymore)
    const staleLeads = allExisting.filter(l => {
      const meta = l.metadata as Record<string, unknown> | null;
      const oid = meta?.odoo_id as string;
      return oid && !fetchedOdooIds.has(oid);
    });

    // Find orphan leads (no odoo_id at all)
    const orphanLeads = allExisting.filter(l => {
      const meta = l.metadata as Record<string, unknown> | null;
      const oid = meta?.odoo_id;
      return !oid && l.stage !== "archived_orphan";
    });

    let reconciled = 0;

    // Archive orphans (always, regardless of mode)
    if (orphanLeads.length > 0) {
      console.log(`Reconciliation: ${orphanLeads.length} orphan leads with NULL odoo_id — archiving`);
      for (const ol of orphanLeads) {
        const meta = ol.metadata as Record<string, unknown> | null;
        await serviceClient.from("leads").update({
          stage: "archived_orphan",
          updated_at: new Date().toISOString(),
          metadata: { ...meta, archived_reason: "null_odoo_id_orphan", archived_at: new Date().toISOString() },
        }).eq("id", ol.id);
        reconciled++;
      }
    }

    if (staleLeads.length > 0 && mode === "full") {
      console.log(`Reconciliation: ${staleLeads.length} ERP leads not found in Odoo full fetch — marking as archived_orphan`);
      for (const sl of staleLeads) {
        const meta = sl.metadata as Record<string, unknown> | null;
        const oid = (meta?.odoo_id as string) || "unknown";
        // Only archive if not already in a terminal stage
        if (!TERMINAL_STAGES.has(sl.stage)) {
          await serviceClient.from("leads").update({
            stage: "archived_orphan",
            updated_at: new Date().toISOString(),
            metadata: { ...meta, archived_reason: "not_found_in_odoo_full_sync", archived_at: new Date().toISOString() },
          }).eq("id", sl.id);
          await insertLeadEvent(serviceClient, sl.id, "stage_changed", {
            from: sl.stage, to: "archived_orphan", source: "reconciliation_archive",
            reason: "Lead not found in Odoo full fetch",
          });
          reconciled++;
        }
        allValidationWarnings.push({
          odoo_id: oid,
          severity: "warning", validation_type: "stale_lead",
          message: "ERP lead not found in Odoo full fetch — archived",
          auto_fixed: true, fix_applied: "Stage set to archived_orphan",
        });
      }
    } else if (staleLeads.length > 0) {
      // Incremental mode: do targeted lookups for stale leads
      const staleOdooIds = staleLeads.map(l => (l.metadata as Record<string, unknown>)?.odoo_id as string).filter(Boolean);
      console.log(`Reconciliation: checking ${staleOdooIds.length} stale leads against Odoo`);

      // Batch lookup in chunks of 50
      for (let i = 0; i < staleOdooIds.length; i += 50) {
        const batch = staleOdooIds.slice(i, i + 50);
        try {
          const result = await odooRpc(odooUrl, odooDB, odooKey, "crm.lead", "search_read", [
            [[["type", "=", "opportunity"], ["id", "in", batch.map(Number)]]],
            { fields: ["id", "stage_id"] },
          ]);

          for (const r of result) {
            const odooId = String(r.id);
            const stageName = Array.isArray(r.stage_id) ? r.stage_id[1] : String(r.stage_id || "");
            const erpStage = STAGE_MAP[stageName] || "new";
            const existing = odooIdMap.get(odooId);
            if (existing && existing.stage !== erpStage) {
              await serviceClient.from("leads").update({
                stage: erpStage,
                updated_at: new Date().toISOString(),
              }).eq("id", existing.id);
              await insertLeadEvent(serviceClient, existing.id, "stage_changed", {
                from: existing.stage, to: erpStage, odoo_stage: stageName, source: "reconciliation",
              });
              allValidationWarnings.push({
                odoo_id: odooId, severity: "info", validation_type: "drift_detected",
                message: `Reconciliation fixed drift: ${existing.stage} → ${erpStage}`,
                field_name: "stage", field_value: `${existing.stage} → ${erpStage}`,
                auto_fixed: true, fix_applied: "Stage updated via reconciliation",
              });
              reconciled++;
            }
          }
        } catch (e) {
          console.error("Reconciliation batch error:", e);
        }
      }
    }

    // === Persist validation warnings ===
    const validationSummary = summarizeWarnings(allValidationWarnings);
    console.log(`Validation summary:`, JSON.stringify(validationSummary));
    await persistValidationWarnings(serviceClient, allValidationWarnings, companyId, syncRunAt, leadIdByOdooId);

    return json({
      created, updated, skipped, errors, reconciled,
      total: leads.length,
      dedup_deleted: victimIds.length,
      mode,
      validation: validationSummary,
    });
  }, { functionName: "odoo-crm-sync", authMode: "optional", requireCompany: false, wrapResult: false })
);
