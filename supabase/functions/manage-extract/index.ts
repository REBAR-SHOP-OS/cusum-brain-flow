import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// Valid RSIC Canada bar sizes
const VALID_BAR_SIZES = [
  "10M", "15M", "20M", "25M", "30M", "35M", "45M", "55M",
];

// Imperial (US ASTM) → Metric mapping
const IMPERIAL_TO_METRIC: Record<string, string> = {
  "#3": "10M", "#4": "15M", "#5": "15M", "#6": "20M",
  "#7": "25M", "#8": "25M", "#9": "30M", "#10": "35M",
  "#11": "35M", "#14": "45M", "#18": "55M",
  "3": "10M", "4": "15M", "5": "15M", "6": "20M",
  "7": "25M", "8": "25M", "9": "30M", "10": "35M",
  "11": "35M", "14": "45M", "18": "55M",
};

const ALL_VALID_SIZES = [...VALID_BAR_SIZES, ...Object.keys(IMPERIAL_TO_METRIC)];

/** Normalize any bar size to its canonical metric code */
function normalizeBarSize(raw: string): string | null {
  const upper = raw.toUpperCase().trim();
  if (VALID_BAR_SIZES.includes(upper)) return upper;
  // Try metric regex
  const mMatch = upper.match(/(\d+)\s*M/i);
  if (mMatch && VALID_BAR_SIZES.includes(`${mMatch[1]}M`)) return `${mMatch[1]}M`;
  // Try imperial
  const cleaned = raw.trim().replace(/^#/, "#");
  if (IMPERIAL_TO_METRIC[cleaned]) return IMPERIAL_TO_METRIC[cleaned];
  if (IMPERIAL_TO_METRIC[`#${cleaned}`]) return IMPERIAL_TO_METRIC[`#${cleaned}`];
  return null;
}

// Valid grades
const VALID_GRADES = ["400W", "500W", "300W"];

// ─── Session Name Validation ────────────────────────────────
const JUNK_NAMES = [
  "test", "testing", "asdf", "qwerty", "xxx", "abc", "aaa", "zzz",
  "123", "1234", "12345", "foo", "bar", "baz", "temp", "tmp",
  "undefined", "null", "none", "untitled", "new", "n/a",
];

function validateSessionName(name: string): { valid: boolean; reason?: string } {
  if (!name || typeof name !== "string") {
    return { valid: false, reason: "Session name is required" };
  }
  const trimmed = name.trim();
  if (trimmed.length < 3) {
    return { valid: false, reason: "Session name must be at least 3 characters" };
  }
  // Check for whitespace-only
  if (/^\s+$/.test(name)) {
    return { valid: false, reason: "Session name cannot be whitespace only" };
  }
  // Check for junk names
  if (JUNK_NAMES.includes(trimmed.toLowerCase())) {
    return { valid: false, reason: `"${trimmed}" is not a valid session name. Use a meaningful project/manifest name.` };
  }
  // Check for repeating single char
  if (/^(.)\1+$/.test(trimmed)) {
    return { valid: false, reason: "Session name must be meaningful" };
  }
  return { valid: true };
}

// ─── Duplicate Key Computation ──────────────────────────────
function computeDuplicateKey(row: any, sessionName: string): string {
  const project = (sessionName || "").trim().toLowerCase();
  const mark = (row.mark || "").trim().toLowerCase();
  const size = (row.bar_size_mapped || row.bar_size || "").trim().toLowerCase();
  const length = String(row.total_length_mm || 0);
  const shape = (row.shape_code_mapped || row.shape_type || "straight").trim().toLowerCase();
  return `${project}:${mark}:${size}:${length}:${shape}`;
}

// ─── Production Event Logger ────────────────────────────────
async function logProductionEvent(sb: any, event: {
  company_id: string;
  session_id?: string;
  job_id?: string;
  row_id?: string;
  machine_id?: string;
  batch_id?: string;
  event_type: string;
  old_status?: string;
  new_status?: string;
  triggered_by?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await sb.from("production_events").insert({
      company_id: event.company_id,
      session_id: event.session_id || null,
      job_id: event.job_id || null,
      row_id: event.row_id || null,
      machine_id: event.machine_id || null,
      batch_id: event.batch_id || null,
      event_type: event.event_type,
      old_status: event.old_status || null,
      new_status: event.new_status || null,
      triggered_by: event.triggered_by || null,
      metadata: event.metadata || {},
    });
  } catch (err) {
    console.error("[logProductionEvent] Failed:", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { action, sessionId, ...params } = await req.json();
    const sb = supabaseAdmin();

    switch (action) {
      case "apply-mapping":
        return await applyMapping(sb, sessionId, params.unitSystem);

      case "validate":
        return await validateExtract(sb, sessionId);

      case "detect-duplicates":
        return await detectDuplicates(sb, sessionId, user.id, params.dryRun === true);

      case "approve":
        return await approveExtract(sb, sessionId, user.id, params.optimizerConfig);

      case "reject":
        return await rejectExtract(sb, sessionId, user.id, params.reason);

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("manage-extract error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500,
    );
  }
});

// ─── Detect Duplicates ──────────────────────────────────────
async function detectDuplicates(sb: any, sessionId: string, userId: string, dryRun: boolean = false) {
  const { data: session } = await sb
    .from("extract_sessions")
    .select("id, company_id, name, status")
    .eq("id", sessionId)
    .single();

  if (!session) return jsonResponse({ error: "Session not found" }, 404);

  // Get all active (non-merged) rows
  const { data: rows } = await sb
    .from("extract_rows")
    .select("*")
    .eq("session_id", sessionId)
    .is("merged_into_id", null)
    .neq("status", "merged")
    .order("row_index");

  if (!rows?.length) return jsonResponse({ duplicates_found: 0, rows_merged: 0, preview: [] });

  // Compute duplicate_key for all rows
  const keyMap = new Map<string, any[]>();
  for (const row of rows) {
    const key = computeDuplicateKey(row, session.name);
    // Always update duplicate_key in DB (even dry-run, for visibility)
    await sb.from("extract_rows").update({ duplicate_key: key }).eq("id", row.id);
    if (!keyMap.has(key)) keyMap.set(key, []);
    keyMap.get(key)!.push(row);
  }

  let duplicatesFound = 0;
  let rowsMerged = 0;
  const preview: Array<{
    duplicate_key: string;
    survivor_mark: string;
    survivor_row_index: number;
    absorbed_count: number;
    original_qty: number;
    new_qty: number;
    absorbed_rows: Array<{ row_index: number; mark: string; quantity: number }>;
  }> = [];

  for (const [key, group] of keyMap.entries()) {
    if (group.length <= 1) continue;

    duplicatesFound++;
    const survivor = group[0];
    const absorbed = group.slice(1);
    const totalQty = group.reduce((s: number, r: any) => s + (r.quantity || 0), 0);

    // Build preview entry for both dry-run and real merge
    preview.push({
      duplicate_key: key,
      survivor_mark: survivor.mark || `Row ${survivor.row_index}`,
      survivor_row_index: survivor.row_index,
      absorbed_count: absorbed.length,
      original_qty: survivor.quantity || 0,
      new_qty: totalQty,
      absorbed_rows: absorbed.map((r: any) => ({
        row_index: r.row_index,
        mark: r.mark || "",
        quantity: r.quantity || 0,
      })),
    });

    if (dryRun) {
      rowsMerged += absorbed.length;
      continue;
    }

    // Save original quantity on survivor if not already set
    if (survivor.original_quantity == null) {
      await sb.from("extract_rows").update({
        original_quantity: survivor.quantity,
        quantity: totalQty,
      }).eq("id", survivor.id);
    } else {
      await sb.from("extract_rows").update({
        quantity: totalQty,
      }).eq("id", survivor.id);
    }

    // Mark absorbed rows
    for (const absorbed_row of absorbed) {
      await sb.from("extract_rows").update({
        merged_into_id: survivor.id,
        status: "merged",
        original_quantity: absorbed_row.quantity,
        duplicate_key: key,
      }).eq("id", absorbed_row.id);
      rowsMerged++;

      // Log merge event
      await logProductionEvent(sb, {
        company_id: session.company_id,
        session_id: sessionId,
        row_id: absorbed_row.id,
        event_type: "duplicate_merged",
        triggered_by: userId,
        metadata: {
          survivor_row_id: survivor.id,
          absorbed_row_id: absorbed_row.id,
          duplicate_key: key,
          absorbed_quantity: absorbed_row.quantity,
          new_total_quantity: totalQty,
        },
      });
    }
  }

  if (!dryRun) {
    // Update session status to indicate dedup completed
    await sb.from("extract_sessions")
      .update({ status: "extracted" })
      .eq("id", sessionId);
  }

  return jsonResponse({
    success: true,
    dry_run: dryRun,
    duplicates_found: duplicatesFound,
    rows_merged: rowsMerged,
    total_active_rows: rows.length - rowsMerged,
    preview,
  });
}

// ─── Unit Conversion Helpers ────────────────────────────────
const DIM_COLUMNS = [
  "dim_a", "dim_b", "dim_c", "dim_d", "dim_e", "dim_f",
  "dim_g", "dim_h", "dim_j", "dim_k", "dim_o", "dim_r",
];

function getLengthFactor(unitSystem: string): number {
  switch (unitSystem) {
    case "in": return 25.4;
    case "ft": return 304.8;
    case "imperial": return 25.4; // imperial stores as inches
    default: return 1; // mm or metric
  }
}

// ─── Apply Mapping ──────────────────────────────────────────
async function applyMapping(sb: any, sessionId: string, unitSystem?: string) {
  // Get session — include unit_system
  const { data: session } = await sb
    .from("extract_sessions")
    .select("id, company_id, status, unit_system")
    .eq("id", sessionId)
    .single();

  if (!session) return jsonResponse({ error: "Session not found" }, 404);

  // If unitSystem passed from client, persist it server-side (admin client bypasses RLS)
  const effectiveUnit = unitSystem || session.unit_system || "mm";
  if (unitSystem && unitSystem !== session.unit_system) {
    await sb.from("extract_sessions").update({ unit_system: unitSystem }).eq("id", sessionId);
    console.log(`[applyMapping] Updated session unit_system: ${session.unit_system} → ${unitSystem}`);
  }

  const lengthFactor = getLengthFactor(effectiveUnit);

  // Get company mappings
  const { data: mappings } = await sb
    .from("extract_mapping")
    .select("*")
    .eq("company_id", session.company_id);

  const mappingLookup: Record<string, Record<string, string>> = {};
  for (const m of mappings || []) {
    if (!mappingLookup[m.source_field]) mappingLookup[m.source_field] = {};
    mappingLookup[m.source_field][m.source_value.toUpperCase()] = m.mapped_value;
  }

  // Get all active rows (exclude merged)
  const { data: rows } = await sb
    .from("extract_rows")
    .select("*")
    .eq("session_id", sessionId)
    .neq("status", "merged");

  if (!rows?.length) return jsonResponse({ error: "No rows to map" }, 400);

  let mappedCount = 0;
  const autoMappings: Array<{ source_field: string; source_value: string; mapped_value: string }> = [];

  for (const row of rows) {
    const updates: Record<string, any> = { status: "mapped" };

    // ── Store raw values on first mapping (or restore if re-mapping) ──
    // If raw_total_length_mm is already set, this is a re-apply: restore originals first
    const rawLength = row.raw_total_length_mm != null ? row.raw_total_length_mm : row.total_length_mm;
    const rawDims: Record<string, any> = {};
    if (row.raw_dims_json != null) {
      // Restore from saved originals
      Object.assign(rawDims, row.raw_dims_json);
    } else {
      // Save current values as originals
      for (const col of DIM_COLUMNS) {
        rawDims[col] = row[col];
      }
    }

    // Save originals (idempotent — always write so re-apply works)
    updates.raw_total_length_mm = rawLength;
    updates.raw_dims_json = rawDims;

    // ── Apply unit conversion to length ──
    if (rawLength != null && lengthFactor !== 1) {
      updates.total_length_mm = Math.round(Number(rawLength) * lengthFactor);
    } else if (rawLength != null) {
      updates.total_length_mm = rawLength; // mm → no conversion, but restore from raw
    }

    // ── Apply unit conversion to all dimensions ──
    for (const col of DIM_COLUMNS) {
      const rawVal = rawDims[col] ?? row[col];
      if (rawVal != null && rawVal !== 0 && lengthFactor !== 1) {
        updates[col] = Math.round(Number(rawVal) * lengthFactor);
      } else if (rawVal != null) {
        updates[col] = rawVal; // restore from raw
      }
    }

    // Map bar_size (supports both metric and imperial)
    const rawSize = (row.bar_size || "").trim();
    if (mappingLookup["bar_size"]?.[rawSize.toUpperCase()]) {
      updates.bar_size_mapped = mappingLookup["bar_size"][rawSize.toUpperCase()];
    } else {
      const normalized = normalizeBarSize(rawSize);
      if (normalized) {
        updates.bar_size_mapped = normalized;
        if (normalized !== rawSize.toUpperCase()) {
          autoMappings.push({
            source_field: "bar_size",
            source_value: rawSize,
            mapped_value: normalized,
          });
        }
      } else {
        updates.bar_size_mapped = rawSize.toUpperCase(); // Keep raw, will fail validation
      }
    }

    // Map grade
    const rawGrade = (row.grade || "").toUpperCase().trim();
    if (mappingLookup["grade"]?.[rawGrade]) {
      updates.grade_mapped = mappingLookup["grade"][rawGrade];
    } else if (VALID_GRADES.includes(rawGrade)) {
      updates.grade_mapped = rawGrade;
    } else {
      // Try auto: 500N → 500W, 400 → 400W
      const gradeNum = rawGrade.replace(/[^0-9]/g, "");
      const autoGrade = `${gradeNum}W`;
      if (VALID_GRADES.includes(autoGrade)) {
        updates.grade_mapped = autoGrade;
        autoMappings.push({
          source_field: "grade",
          source_value: rawGrade,
          mapped_value: autoGrade,
        });
      } else {
        updates.grade_mapped = rawGrade;
      }
    }

    // Map shape_type → shape_code_mapped
    const rawShape = (row.shape_type || "").toUpperCase().trim();
    if (mappingLookup["shape_type"]?.[rawShape]) {
      updates.shape_code_mapped = mappingLookup["shape_type"][rawShape];
    } else {
      updates.shape_code_mapped = rawShape || null;
    }

    // ── Straight-bar dimension normalization ──
    // Per rebar industry convention, straight bars (STR / no shape code) must
    // have their straight length in dimension B, not A.
    // This runs AFTER unit conversion so values are already in mm.
    const effectiveShape = (updates.shape_code_mapped || "").toUpperCase();
    const isStraight = !effectiveShape || effectiveShape === "STR" || effectiveShape === "STRAIGHT";
    if (isStraight) {
      const dimA = updates.dim_a ?? row.dim_a;
      const dimB = updates.dim_b ?? row.dim_b;
      const hasA = dimA != null && dimA !== 0 && dimA !== "";
      const hasB = dimB != null && dimB !== 0 && dimB !== "";
      if (hasA && !hasB) {
        // Move A → B, clear A
        updates.dim_b = dimA;
        updates.dim_a = null;
      }
      // If both A and B exist, leave as-is (source explicitly provided both)
    }

    await sb
      .from("extract_rows")
      .update(updates)
      .eq("id", row.id);

    mappedCount++;
  }

  // Save auto-discovered mappings
  for (const am of autoMappings) {
    await sb
      .from("extract_mapping")
      .upsert(
        {
          company_id: session.company_id,
          source_field: am.source_field,
          source_value: am.source_value,
          mapped_value: am.mapped_value,
          is_auto: true,
        },
        { onConflict: "company_id,source_field,source_value" },
      );
  }

  // Update session status
  await sb
    .from("extract_sessions")
    .update({ status: "mapped" })
    .eq("id", sessionId);

  return jsonResponse({
    success: true,
    mapped_count: mappedCount,
    auto_mappings_created: autoMappings.length,
    unit_system: effectiveUnit,
    length_factor: lengthFactor,
  });
}

// ─── Validate ───────────────────────────────────────────────
async function validateExtract(sb: any, sessionId: string) {
  const { data: session } = await sb
    .from("extract_sessions")
    .select("id, company_id")
    .eq("id", sessionId)
    .single();

  if (!session) return jsonResponse({ error: "Session not found" }, 404);

  // Clear previous errors
  await sb
    .from("extract_errors")
    .delete()
    .eq("session_id", sessionId);

  // Only validate active (non-merged) rows
  const { data: rows } = await sb
    .from("extract_rows")
    .select("*")
    .eq("session_id", sessionId)
    .neq("status", "merged");

  if (!rows?.length) return jsonResponse({ error: "No rows to validate" }, 400);

  const errors: Array<{
    session_id: string;
    row_id: string;
    field: string;
    error_type: string;
    message: string;
  }> = [];

  for (const row of rows) {
    // Bar size validation
    const barSize = row.bar_size_mapped || row.bar_size;
    if (!barSize) {
      errors.push({
        session_id: sessionId,
        row_id: row.id,
        field: "bar_size",
        error_type: "blocker",
        message: `Row ${row.row_index}: Missing bar size`,
      });
    } else if (!VALID_BAR_SIZES.includes(barSize.toUpperCase()) && !normalizeBarSize(barSize)) {
      errors.push({
        session_id: sessionId,
        row_id: row.id,
        field: "bar_size",
        error_type: "blocker",
        message: `Row ${row.row_index}: Invalid bar size "${barSize}". Expected metric: ${VALID_BAR_SIZES.join(", ")} or imperial: #3, #4, #5, #6, #8, #9, #11, #14, #18`,
      });
    }

    // Grade validation
    const grade = row.grade_mapped || row.grade;
    if (!grade) {
      errors.push({
        session_id: sessionId,
        row_id: row.id,
        field: "grade",
        error_type: "warning",
        message: `Row ${row.row_index}: Missing grade, will default to 400W`,
      });
    } else if (!VALID_GRADES.includes(grade.toUpperCase())) {
      errors.push({
        session_id: sessionId,
        row_id: row.id,
        field: "grade",
        error_type: "warning",
        message: `Row ${row.row_index}: Unrecognized grade "${grade}"`,
      });
    }

    // Quantity validation
    if (!row.quantity || row.quantity <= 0) {
      errors.push({
        session_id: sessionId,
        row_id: row.id,
        field: "quantity",
        error_type: "blocker",
        message: `Row ${row.row_index}: Invalid quantity (${row.quantity})`,
      });
    }

    // Length validation
    if (!row.total_length_mm || row.total_length_mm <= 0) {
      errors.push({
        session_id: sessionId,
        row_id: row.id,
        field: "total_length_mm",
        error_type: "warning",
        message: `Row ${row.row_index}: Missing or zero length`,
      });
    } else if (row.total_length_mm > 18000) {
      errors.push({
        session_id: sessionId,
        row_id: row.id,
        field: "total_length_mm",
        error_type: "warning",
        message: `Row ${row.row_index}: Length ${row.total_length_mm}mm exceeds typical max (18000mm)`,
      });
    }

    // Mark validation
    if (!row.mark) {
      errors.push({
        session_id: sessionId,
        row_id: row.id,
        field: "mark",
        error_type: "warning",
        message: `Row ${row.row_index}: Missing mark number`,
      });
    }
  }

  // Insert errors (with company_id for direct RLS)
  if (errors.length > 0) {
    const errorsWithCompany = errors.map((e: any) => ({ ...e, company_id: session.company_id }));
    await sb.from("extract_errors").insert(errorsWithCompany);
  }

  const blockers = errors.filter((e) => e.error_type === "blocker").length;
  const warnings = errors.filter((e) => e.error_type === "warning").length;

  await sb
    .from("extract_sessions")
    .update({ status: "validated" })
    .eq("id", sessionId);

  return jsonResponse({
    success: true,
    total_rows: rows.length,
    blockers,
    warnings,
    can_approve: blockers === 0,
  });
}

// ─── Approve ────────────────────────────────────────────────
async function approveExtract(sb: any, sessionId: string, userId: string, optimizerConfig?: any) {
  // ── Session name validation ───────────────────────────────
  const { data: session } = await sb
    .from("extract_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) return jsonResponse({ error: "Session not found" }, 404);

  // Idempotency guard: already approved
  if (session.status === "approved") {
    return jsonResponse({ error: "Session already approved", already_approved: true }, 400);
  }

  // Session name validation
  const nameCheck = validateSessionName(session.name);
  if (!nameCheck.valid) {
    await logProductionEvent(sb, {
      company_id: session.company_id,
      session_id: sessionId,
      event_type: "session_name_blocked",
      triggered_by: userId,
      metadata: { name: session.name, reason: nameCheck.reason },
    });
    return jsonResponse({ error: nameCheck.reason }, 400);
  }

  // Re-check blockers at approval time (not relying on stale validation)
  const { data: blockers } = await sb
    .from("extract_errors")
    .select("id")
    .eq("session_id", sessionId)
    .eq("error_type", "blocker");

  if (blockers?.length > 0) {
    await logProductionEvent(sb, {
      company_id: session.company_id,
      session_id: sessionId,
      event_type: "approval_blocked",
      triggered_by: userId,
      metadata: { blocker_count: blockers.length },
    });
    return jsonResponse(
      { error: `Cannot approve: ${blockers.length} blocking errors remain` },
      400,
    );
  }

  // Get only active rows (exclude merged)
  const { data: rows } = await sb
    .from("extract_rows")
    .select("*")
    .eq("session_id", sessionId)
    .neq("status", "merged")
    .order("row_index");

  if (!rows?.length)
    return jsonResponse({ error: "No rows to approve" }, 400);

  // ── Resolve or create Project ─────────────────────────────
  let projectId: string | null = null;

  // Check if session has a linked barlist with a project already
  const { data: existingBarlist } = await sb
    .from("barlists")
    .select("id, project_id")
    .eq("extract_session_id", sessionId)
    .maybeSingle();

  if (existingBarlist?.project_id) {
    projectId = existingBarlist.project_id;
  } else {
    // Create project
    const projectName = session.name || session.customer || "Unnamed Project";
    const { data: project } = await sb
      .from("projects")
      .insert({
        company_id: session.company_id,
        name: projectName,
        site_address: session.site_address || null,
        created_by: userId,
      })
      .select("id")
      .single();
    projectId = project?.id || null;

    // Log project event
    if (projectId) {
      await sb.from("activity_events").insert({
        company_id: session.company_id,
        entity_type: "project",
        entity_id: projectId,
        event_type: "project_created",
        actor_id: userId,
        actor_type: "user",
        description: `Project "${projectName}" created from extract session`,
        source: "system",
        dedupe_key: `project:${projectId}:created`,
      });
    }
  }

  // ── Create or update Barlist ──────────────────────────────
  let barlistId: string | null = existingBarlist?.id || null;

  if (!barlistId && projectId) {
    const { data: barlist } = await sb
      .from("barlists")
      .insert({
        company_id: session.company_id,
        project_id: projectId,
        name: session.name || "Barlist",
        source_type: "ai_extract",
        extract_session_id: sessionId,
        created_by: userId,
        status: "approved",
      })
      .select("id")
      .single();
    barlistId = barlist?.id || null;

    // Log barlist_created event
    if (barlistId) {
      await sb.from("activity_events").insert({
        company_id: session.company_id,
        entity_type: "barlist",
        entity_id: barlistId,
        event_type: "barlist_created",
        actor_id: userId,
        actor_type: "user",
        description: `Barlist created from AI extraction: ${session.name}`,
        metadata: { session_id: sessionId, item_count: rows.length },
        source: "system",
        dedupe_key: `barlist:${barlistId}:created`,
      });
    }
  } else if (barlistId) {
    await sb.from("barlists").update({ status: "approved" }).eq("id", barlistId);
  }

  // ── Create barlist_items from extract_rows ────────────────
  if (barlistId) {
    const barlistItems = rows.map((row: any) => ({
      barlist_id: barlistId,
      mark: row.mark,
      qty: row.quantity || 0,
      bar_code: row.bar_size_mapped || row.bar_size || null,
      grade: row.grade_mapped || row.grade || null,
      shape_code: row.shape_code_mapped || row.shape_type || null,
      cut_length_mm: row.total_length_mm || null,
      dims_json: buildDimensions(row),
      weight_kg: row.weight_kg || null,
      drawing_ref: row.dwg || null,
      source_row_id: row.id,
      status: "approved",
    }));
    await sb.from("barlist_items").insert(barlistItems);

    // Log barlist_approved event
    await sb.from("activity_events").insert({
      company_id: session.company_id,
      entity_type: "barlist",
      entity_id: barlistId,
      event_type: "barlist_approved",
      actor_id: userId,
      actor_type: "user",
      description: `Barlist approved with ${rows.length} items`,
      metadata: { session_id: sessionId, item_count: rows.length },
      source: "system",
      dedupe_key: `barlist:${barlistId}:approved`,
    });
  }

  // ── Create order + customer (existing logic) ──────────────
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
  let customerId: string | null = null;

  const customerName = session.customer || rows[0]?.customer;
  if (customerName) {
    const { data: existingCust } = await sb
      .from("customers")
      .select("id")
      .eq("company_id", session.company_id)
      .ilike("name", customerName)
      .maybeSingle();
    if (existingCust) {
      customerId = existingCust.id;
    } else {
      const { data: newCust } = await sb
        .from("customers")
        .insert({ name: customerName, company_id: session.company_id })
        .select("id")
        .single();
      customerId = newCust?.id || null;
    }
  }
  if (!customerId) {
    const { data: placeholderCust } = await sb
      .from("customers")
      .insert({ name: session.name || "Unknown", company_id: session.company_id })
      .select("id")
      .single();
    customerId = placeholderCust?.id;
  }

  // Link customer to project
  if (projectId && customerId) {
    await sb.from("projects").update({ customer_id: customerId }).eq("id", projectId);
  }

  const { data: order } = await sb
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: customerId,
      company_id: session.company_id,
      notes: `Auto-created from extract session: ${session.name}`,
      status: "extract_new",
      order_kind: "extract",
    })
    .select("id")
    .single();

  if (!order) return jsonResponse({ error: "Failed to create order" }, 500);

  // ── Create work order linked to barlist + project ─────────
  const woNumber = `WO-${Date.now().toString(36).toUpperCase()}`;
  const { data: workOrder } = await sb
    .from("work_orders")
    .insert({
      work_order_number: woNumber,
      order_id: order.id,
      status: "pending",
      notes: `Extract session: ${session.name} · ${rows.length} items`,
      barlist_id: barlistId,
      project_id: projectId,
    })
    .select("id")
    .single();

  if (!workOrder)
    return jsonResponse({ error: "Failed to create work order" }, 500);

  // ── Create cut plan linked to project ─────────────────────
  const { data: cutPlan } = await sb
    .from("cut_plans")
    .insert({
      name: session.name,
      company_id: session.company_id,
      created_by: userId,
      project_name: session.name,
      project_id: projectId,
      barlist_id: barlistId || null,
      status: "draft",
      optimization_mode: optimizerConfig?.selectedMode || "combination",
    })
    .select("id")
    .single();

  // ── Create cut_plan_items + production_tasks ──────────────
  if (cutPlan) {
    const STOCK_LENGTH_MM = optimizerConfig?.stockLengthMm || 12000;
    const KERF_MM = optimizerConfig?.kerfMm || 5;
    const cutItems = rows.map((row: any) => {
      const cutLen = row.total_length_mm || 0;
      const totalPieces = row.quantity || 1;
      const effectiveCut = cutLen + KERF_MM;
      const piecesPerBar = cutLen > 0 ? Math.floor(STOCK_LENGTH_MM / effectiveCut) : 1;
      const qtyBars = Math.ceil(totalPieces / Math.max(piecesPerBar, 1));
      return {
        cut_plan_id: cutPlan.id,
        bar_code: row.bar_size_mapped || row.bar_size || "10M",
        qty_bars: qtyBars,
        pieces_per_bar: piecesPerBar,
        cut_length_mm: cutLen,
        mark_number: row.mark,
        drawing_ref: row.dwg,
        bend_type: row.shape_code_mapped ? "bend" : "straight",
        asa_shape_code: row.shape_code_mapped || null,
        total_pieces: totalPieces,
        work_order_id: workOrder.id,
        bend_dimensions: buildDimensions(row),
      };
    });

    await sb.from("cut_plan_items").insert(cutItems);

    // Generate production_tasks
    const { data: savedItems } = await sb
      .from("cut_plan_items")
      .select("id, bar_code, cut_length_mm, mark_number, drawing_ref, bend_type, asa_shape_code, total_pieces, bend_dimensions, work_order_id")
      .eq("cut_plan_id", cutPlan.id);

    if (savedItems?.length) {
      const tasks = savedItems.map((item: any) => ({
        company_id: session.company_id,
        project_id: projectId,
        order_id: order.id,
        work_order_id: item.work_order_id || workOrder.id,
        barlist_id: barlistId,
        cut_plan_id: cutPlan.id,
        cut_plan_item_id: item.id,
        task_type: item.bend_type === "bend" ? "bend" : "cut",
        bar_code: item.bar_code,
        setup_key: `${item.bar_code}_${item.bend_type === "bend" ? "bend" : "straight"}`,
        priority: 100,
        status: "pending",
        qty_required: item.total_pieces,
        qty_completed: 0,
        mark_number: item.mark_number,
        drawing_ref: item.drawing_ref,
        cut_length_mm: item.cut_length_mm,
        asa_shape_code: item.asa_shape_code,
        bend_dimensions: item.bend_dimensions,
        created_by: userId,
      }));

      const { data: createdTasks, error: taskErr } = await sb
        .from("production_tasks")
        .insert(tasks)
        .select("id, task_type, bar_code");

      if (taskErr) {
        console.error("Failed to create production tasks:", taskErr);
      } else {
        // Auto-dispatch with barlist_id
        for (const task of (createdTasks || [])) {
          try {
            await autoDispatchTask(sb, task.id, session.company_id, barlistId);
          } catch (dispatchErr) {
            console.error(`Auto-dispatch failed for task ${task.id}:`, dispatchErr);
          }
        }
      }
    }
  }

  // ── Log barlist_sent_to_production event ───────────────────
  if (barlistId) {
    await sb.from("barlists").update({ status: "in_production" }).eq("id", barlistId);
    await sb.from("activity_events").insert({
      company_id: session.company_id,
      entity_type: "barlist",
      entity_id: barlistId,
      event_type: "barlist_sent_to_production",
      actor_id: userId,
      actor_type: "user",
      description: `Barlist sent to production → WO ${woNumber}`,
      metadata: {
        work_order_id: workOrder.id,
        cut_plan_id: cutPlan?.id,
        work_order_number: woNumber,
      },
      source: "system",
      dedupe_key: `barlist:${barlistId}:sent_to_production`,
    });
  }

  // Update session status
  await sb
    .from("extract_sessions")
    .update({ status: "approved" })
    .eq("id", sessionId);

  await sb
    .from("extract_rows")
    .update({ status: "approved" })
    .eq("session_id", sessionId)
    .neq("status", "merged");

  // Log validation_approved production event
  await logProductionEvent(sb, {
    company_id: session.company_id,
    session_id: sessionId,
    event_type: "validation_approved",
    triggered_by: userId,
    new_status: "approved",
    metadata: {
      order_id: order.id,
      work_order_id: workOrder.id,
      cut_plan_id: cutPlan?.id,
      barlist_id: barlistId,
      project_id: projectId,
      item_count: rows.length,
      work_order_number: woNumber,
    },
  });

  // Log session event (activity_events)
  await sb.from("activity_events").insert({
    company_id: session.company_id,
    entity_type: "extract_session",
    entity_id: sessionId,
    event_type: "approved",
    actor_id: userId,
    actor_type: "user",
    description: `Approved ${rows.length} items → WO ${woNumber}`,
    metadata: {
      order_id: order.id,
      work_order_id: workOrder.id,
      cut_plan_id: cutPlan?.id,
      barlist_id: barlistId,
      project_id: projectId,
      item_count: rows.length,
    },
    source: "system",
    dedupe_key: `extract_session:${sessionId}:approved`,
  });

  return jsonResponse({
    success: true,
    order_id: order.id,
    work_order_id: workOrder.id,
    cut_plan_id: cutPlan?.id,
    barlist_id: barlistId,
    project_id: projectId,
    work_order_number: woNumber,
    items_approved: rows.length,
  });
}

// ─── Reject ─────────────────────────────────────────────────
async function rejectExtract(sb: any, sessionId: string, userId: string, reason?: string) {
  const { data: session } = await sb
    .from("extract_sessions")
    .select("id, name, status, company_id")
    .eq("id", sessionId)
    .single();

  if (!session) return jsonResponse({ error: "Session not found" }, 404);
  if (session.status === "approved") {
    return jsonResponse({ error: "Cannot reject an already approved session" }, 400);
  }

  await sb
    .from("extract_sessions")
    .update({ status: "rejected" })
    .eq("id", sessionId);

  await sb
    .from("extract_rows")
    .update({ status: "rejected" })
    .eq("session_id", sessionId);

  // Log event
  try {
    await sb.from("activity_events").insert({
      entity_type: "extract_session",
      entity_id: sessionId,
      event_type: "rejected",
      actor_id: userId,
      actor_type: "user",
      company_id: session.company_id,
      description: `Rejected session "${session.name}"${reason ? `: ${reason}` : ""}`,
      metadata: { reason: reason || null, previous_status: session.status },
      source: "system",
      dedupe_key: `extract_session:${sessionId}:rejected`,
    });
  } catch (logErr) {
    console.error("Failed to log reject event:", logErr);
  }

  return jsonResponse({ success: true, status: "rejected" });
}

// ─── Auto-Dispatch a task to best available machine ─────────
async function autoDispatchTask(sb: any, taskId: string, companyId: string, barlistId?: string | null) {
  const { data: task } = await sb
    .from("production_tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  if (!task) return;

  const processMap: Record<string, string> = { cut: "cut", bend: "bend", spiral: "bend", load: "load", other: "other" };
  const machineProcess = processMap[task.task_type] || task.task_type;

  // Find capable machines
  const { data: capabilities } = await sb
    .from("machine_capabilities")
    .select("machine_id, max_bars")
    .eq("bar_code", task.bar_code)
    .eq("process", machineProcess);

  if (!capabilities?.length) return;

  const capableMachineIds = capabilities.map((c: any) => c.machine_id);

  const { data: machines } = await sb
    .from("machines")
    .select("id, name, status, current_run_id, active_job_id, cut_session_status")
    .in("id", capableMachineIds)
    .eq("company_id", companyId);

  if (!machines?.length) return;

  // Get queue counts
  const { data: queueCounts } = await sb
    .from("machine_queue_items")
    .select("machine_id")
    .in("machine_id", capableMachineIds)
    .in("status", ["queued", "running"]);

  const queueMap = new Map<string, number>();
  for (const q of (queueCounts || [])) {
    queueMap.set((q as any).machine_id, (queueMap.get((q as any).machine_id) || 0) + 1);
  }

  // Score: idle bonus, shortest queue — skip machines with active locked jobs
  let bestMachine = machines[0];
  let bestScore = -Infinity;
  for (const m of machines) {
    let score = 0;
    // Respect machine lock: if cut_session_status is 'running', heavily penalize
    if (m.cut_session_status === "running" && m.active_job_id) {
      score -= 200;
    }
    if (m.status === "idle" && !m.current_run_id) score += 50;
    else if (m.status === "running") score += 10;
    if (m.status === "blocked") score -= 30;
    if (m.status === "down") score -= 100;
    score -= (queueMap.get(m.id) || 0) * 10;
    if (score > bestScore) { bestScore = score; bestMachine = m; }
  }

  // Get next position using a safe approach
  const { data: posData } = await sb
    .from("machine_queue_items")
    .select("position")
    .eq("machine_id", bestMachine.id)
    .in("status", ["queued", "running"])
    .order("position", { ascending: false })
    .limit(1);
  const basePos = posData?.length ? (posData[0] as any).position + 1 : 0;
  const nextPos = basePos + Math.floor(Math.random() * 100);

  // Insert queue item with barlist_id
  const { error: qiErr } = await sb.from("machine_queue_items").insert({
    company_id: companyId,
    task_id: taskId,
    machine_id: bestMachine.id,
    project_id: task.project_id,
    work_order_id: task.work_order_id,
    barlist_id: barlistId || task.barlist_id || null,
    position: nextPos,
    status: "queued",
  });

  if (!qiErr) {
    await sb.from("production_tasks").update({ status: "queued" }).eq("id", taskId);
  }
}

function buildDimensions(row: any): Record<string, number> | null {
  const dims: Record<string, number> = {};
  const fields = [
    ["dim_a", "A"], ["dim_b", "B"], ["dim_c", "C"], ["dim_d", "D"],
    ["dim_e", "E"], ["dim_f", "F"], ["dim_g", "G"], ["dim_h", "H"],
    ["dim_j", "J"], ["dim_k", "K"], ["dim_o", "O"], ["dim_r", "R"],
  ];
  for (const [dbField, label] of fields) {
    if (row[dbField] != null && row[dbField] !== 0) {
      dims[label] = Number(row[dbField]);
    }
  }
  return Object.keys(dims).length > 0 ? dims : null;
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
