import { corsHeaders, json } from "../_shared/auth.ts";
import { isOdooEnabled } from "../_shared/featureFlags.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ODOO_ENABLED feature flag guard
  if (!isOdooEnabled()) {
    console.warn("ODOO_ENABLED guard: flag resolved to false");
    return json({ error: "Odoo integration is disabled", disabled: true }, 200);
  }

  try {
    // Dual-path auth: service role key (cron) OR valid user JWT (manual UI trigger)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    if (token !== serviceRoleKey) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Parse mode from request body
    let mode = "incremental";
    try {
      const body = await req.json();
      if (body?.mode === "full") mode = "full";
    } catch { /* no body = incremental */ }

    const odooUrl = Deno.env.get("ODOO_URL")!.trim();
    const odooKey = Deno.env.get("ODOO_API_KEY")!;
    const odooDB = Deno.env.get("ODOO_DATABASE")!;

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

        // Map Odoo date_deadline to expected_close_date for activity color bar
        const dateDeadline = ol.date_deadline || null;

        const existingId = existingEntry?.id;

        // Normalize probability: won=100, lost=0, others=Odoo ML value
        const normalizedProb = erpStage === "won" ? 100 : erpStage === "lost" || erpStage === "loss" ? 0 : Math.round(Number(ol.probability) || 0);

        // Resolve customer for contact linkage enforcement
        const customerName = ol.partner_name || ol.contact_name || "Unknown";
        let customerId: string | null = null;

        // Always resolve customer for active stages
        if (ACTIVE_STAGES.has(erpStage)) {
          const { data: existingCust } = await serviceClient
            .from("customers")
            .select("id")
            .ilike("name", customerName)
            .eq("company_id", companyId)
            .limit(1)
            .single();

          if (existingCust) {
            customerId = existingCust.id;
          } else {
            const { data: newCust } = await serviceClient
              .from("customers")
              .insert({ name: customerName, company_id: companyId, company_name: ol.partner_name || null })
              .select("id")
              .single();
            customerId = newCust?.id || null;
          }

          if (!customerId) {
            console.warn(`⚠️ Customer resolution failed for odoo_id ${odooId}: "${customerName}" — inserting lead with null customer_id`);
          }
        }

        if (existingId) {
          // Track lead_id for validation log
          leadIdByOdooId.set(odooId, existingId);

          // Detect stage change for timeline parity
          if (previousStage && previousStage !== erpStage) {
            await insertLeadEvent(serviceClient, existingId, "stage_changed", {
              from: previousStage,
              to: erpStage,
              odoo_stage: stageName,
            });
          }

          // Detect value change
          const prevMeta = (allExisting.find(l => l.id === existingId)?.metadata as Record<string, unknown>) || {};
          const prevRevenue = Number(prevMeta.odoo_revenue) || 0;
          const newRevenue = Number(ol.expected_revenue) || 0;
          if (prevRevenue !== newRevenue) {
            await insertLeadEvent(serviceClient, existingId, "value_changed", {
              from: prevRevenue,
              to: newRevenue,
            });
          }

          // ── Contact linking ──
          let contactId: string | null = null;
          if (customerId && (ol.email_from || ol.phone)) {
            // Try email match first, then phone
            if (ol.email_from) {
              const { data: byEmail } = await serviceClient
                .from("contacts").select("id")
                .eq("customer_id", customerId).ilike("email", String(ol.email_from))
                .limit(1).single();
              if (byEmail) contactId = byEmail.id;
            }
            if (!contactId && ol.phone) {
              const { data: byPhone } = await serviceClient
                .from("contacts").select("id")
                .eq("customer_id", customerId).eq("phone", String(ol.phone))
                .limit(1).single();
              if (byPhone) contactId = byPhone.id;
            }
            // Create contact if not found
            if (!contactId) {
              const contactName = String(ol.contact_name || ol.partner_name || "Unknown");
              const nameParts = contactName.trim().split(/\s+/);
              const firstName = nameParts[0] || "Unknown";
              const lastName = nameParts.slice(1).join(" ") || null;
              const { data: newContact } = await serviceClient
                .from("contacts").insert({
                  customer_id: customerId,
                  company_id: companyId,
                  first_name: firstName,
                  last_name: lastName,
                  email: ol.email_from ? String(ol.email_from) : null,
                  phone: ol.phone ? String(ol.phone) : null,
                }).select("id").single();
              contactId = newContact?.id || null;
            }
          }

          // Update existing lead
          const lastTouchedAt = odooUpdatedAt && odooUpdatedAt > now ? odooUpdatedAt : now;
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

          // Enforce contact + customer linkage on update
          if (customerId && ACTIVE_STAGES.has(erpStage)) {
            updatePayload.customer_id = customerId;
          }
          if (contactId) {
            updatePayload.contact_id = contactId;
          }

          const { error } = await serviceClient
            .from("leads")
            .update(updatePayload)
            .eq("id", existingId);

          if (error) { console.error(`Update error for odoo_id ${odooId}:`, error); errors++; }
          else updated++;
        } else {
          // For won/lost stages, still try to resolve customer but don't block
          if (!customerId) {
            const { data: existingCust } = await serviceClient
              .from("customers")
              .select("id")
              .ilike("name", customerName)
              .eq("company_id", companyId)
              .limit(1)
              .single();

            if (existingCust) {
              customerId = existingCust.id;
            } else {
              const { data: newCust } = await serviceClient
                .from("customers")
                .insert({ name: customerName, company_id: companyId, company_name: ol.partner_name || null })
                .select("id")
                .single();
              customerId = newCust?.id || null;
            }
          }

          // ── Contact linking for new leads ──
          let newContactId: string | null = null;
          if (customerId && (ol.email_from || ol.phone)) {
            if (ol.email_from) {
              const { data: byEmail } = await serviceClient
                .from("contacts").select("id")
                .eq("customer_id", customerId).ilike("email", String(ol.email_from))
                .limit(1).single();
              if (byEmail) newContactId = byEmail.id;
            }
            if (!newContactId && ol.phone) {
              const { data: byPhone } = await serviceClient
                .from("contacts").select("id")
                .eq("customer_id", customerId).eq("phone", String(ol.phone))
                .limit(1).single();
              if (byPhone) newContactId = byPhone.id;
            }
            if (!newContactId) {
              const contactName = String(ol.contact_name || ol.partner_name || "Unknown");
              const nameParts = contactName.trim().split(/\s+/);
              const firstName = nameParts[0] || "Unknown";
              const lastName = nameParts.slice(1).join(" ") || null;
              const { data: newContact } = await serviceClient
                .from("contacts").insert({
                  customer_id: customerId,
                  company_id: companyId,
                  first_name: firstName,
                  last_name: lastName,
                  email: ol.email_from ? String(ol.email_from) : null,
                  phone: ol.phone ? String(ol.phone) : null,
                }).select("id").single();
              newContactId = newContact?.id || null;
            }
          }

          const lastTouchedAtInsert = odooUpdatedAt || now;
          const insertPayload = {
              title: ol.name || "Untitled",
              stage: erpStage,
              probability: normalizedProb,
              expected_value: Number(ol.expected_revenue) || 0,
              expected_close_date: dateDeadline,
              source: "odoo_sync",
              customer_id: customerId,
              contact_id: newContactId,
              company_id: companyId,
              metadata,
              priority: mapOdooPriority(ol.priority),
              odoo_created_at: odooCreatedAt,
              odoo_updated_at: odooUpdatedAt,
              last_touched_at: lastTouchedAtInsert,
          };

          const { data: newLead, error } = await serviceClient
            .from("leads")
            .insert(insertPayload)
            .select("id")
            .single();

          if (error) {
            // Unique index violation (23505) — race condition, treat as update
            if (error.code === "23505" && error.message?.includes("odoo_id")) {
              console.warn(`Duplicate caught by unique index for odoo_id ${odooId}, updating instead`);
              const { data: existingRow } = await serviceClient
                .from("leads").select("id").eq("source", "odoo_sync")
                .filter("metadata->>odoo_id", "eq", odooId).limit(1).single();
              if (existingRow) {
                await serviceClient.from("leads").update({
                  ...insertPayload, updated_at: new Date().toISOString(),
                }).eq("id", existingRow.id);
                leadIdByOdooId.set(odooId, existingRow.id);
                updated++;
              } else { errors++; }
            } else {
              console.error(`Insert error for odoo_id ${odooId}:`, error); errors++;
            }
          } else {
            created++;
            if (newLead) {
              leadIdByOdooId.set(odooId, newLead.id);
              await insertLeadEvent(serviceClient, newLead.id, "stage_changed", {
                from: null,
                to: erpStage,
                odoo_stage: stageName,
              });
              if (customerId) {
                await insertLeadEvent(serviceClient, newLead.id, "contact_linked", {
                  customer_name: customerName,
                  customer_id: customerId,
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("Lead processing error:", e);
        errors++;
      }
    }

    // === Reconciliation: check stale ERP leads not in this fetch ===
    const fetchedOdooIds = new Set(leads.map((ol: Record<string, unknown>) => String(ol.id)));
    const staleLeads = allExisting.filter(l => {
      const meta = l.metadata as Record<string, unknown> | null;
      const oid = meta?.odoo_id as string;
      return oid && !fetchedOdooIds.has(oid);
    });

    let reconciled = 0;
    if (staleLeads.length > 0 && mode === "full") {
      console.log(`Reconciliation: ${staleLeads.length} ERP leads not found in Odoo full fetch`);
      // Log stale leads as validation warnings
      for (const sl of staleLeads) {
        const meta = sl.metadata as Record<string, unknown> | null;
        allValidationWarnings.push({
          odoo_id: (meta?.odoo_id as string) || "unknown",
          severity: "warning", validation_type: "stale_lead",
          message: "ERP lead not found in Odoo full fetch — may be deleted or type-changed",
          auto_fixed: false,
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
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Sync error:", err);
    return json({ error: err.message || "Sync failed" }, 500);
  }
});
