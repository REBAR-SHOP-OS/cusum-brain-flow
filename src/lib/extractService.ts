import { supabase } from "@/integrations/supabase/client";
import { getSignedFileUrl } from "@/lib/storageUtils";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

// ── Types ────────────────────────────────────────────────────

export interface ExtractSession {
  id: string;
  company_id: string;
  created_by: string | null;
  name: string;
  customer: string | null;
  site_address: string | null;
  manifest_type: string;
  target_eta: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  status: string;
  optimization_mode: string | null;
  dedupe_status: string;
  unit_system: string;
  created_at: string;
  updated_at: string;
}

export interface ExtractRow {
  id: string;
  session_id: string;
  file_id: string | null;
  row_index: number;
  dwg: string | null;
  item_number: string | null;
  grade: string | null;
  grade_mapped: string | null;
  mark: string | null;
  quantity: number | null;
  bar_size: string | null;
  bar_size_mapped: string | null;
  shape_type: string | null;
  shape_code_mapped: string | null;
  total_length_mm: number | null;
  dim_a: number | null;
  dim_b: number | null;
  dim_c: number | null;
  dim_d: number | null;
  dim_e: number | null;
  dim_f: number | null;
  dim_g: number | null;
  dim_h: number | null;
  dim_j: number | null;
  dim_k: number | null;
  dim_o: number | null;
  dim_r: number | null;
  weight_kg: number | null;
  customer: string | null;
  reference: string | null;
  address: string | null;
  status: string;
  created_at: string;
  // Phase 1 additions
  duplicate_key: string | null;
  merged_into_id: string | null;
  original_quantity: number | null;
  // Raw pre-conversion values for lossless display
  raw_total_length_mm: number | null;
  raw_dims_json: Record<string, number> | null;
  // Exact source text from the uploaded file
  source_total_length_text: string | null;
  source_dims_json: Record<string, string> | null;
}

export interface ExtractError {
  id: string;
  session_id: string;
  row_id: string | null;
  field: string;
  error_type: string;
  message: string;
  created_at: string;
}

// ── Session Name Validation ──────────────────────────────────

const JUNK_NAMES = [
  "test", "testing", "asdf", "qwerty", "xxx", "abc", "aaa", "zzz",
  "123", "1234", "12345", "foo", "bar", "baz", "temp", "tmp",
  "undefined", "null", "none", "untitled", "new", "n/a",
];

export function validateSessionName(name: string): { valid: boolean; reason?: string } {
  if (!name || typeof name !== "string") {
    return { valid: false, reason: "Session name is required" };
  }
  const trimmed = name.trim();
  if (trimmed.length < 3) {
    return { valid: false, reason: "Session name must be at least 3 characters" };
  }
  if (/^\s+$/.test(name)) {
    return { valid: false, reason: "Session name cannot be whitespace only" };
  }
  if (JUNK_NAMES.includes(trimmed.toLowerCase())) {
    return { valid: false, reason: `"${trimmed}" is not a valid session name` };
  }
  if (/^(.)\1+$/.test(trimmed)) {
    return { valid: false, reason: "Session name must be meaningful" };
  }
  return { valid: true };
}

// ── Service Functions ────────────────────────────────────────

export async function createExtractSession(params: {
  companyId: string;
  name: string;
  customer?: string;
  siteAddress?: string;
  manifestType?: string;
  targetEta?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  createdBy?: string;
}): Promise<ExtractSession> {
  const { data, error } = await supabase
    .from("extract_sessions")
    .insert({
      company_id: params.companyId,
      name: params.name || "Untitled",
      customer: params.customer || null,
      site_address: params.siteAddress || null,
      manifest_type: params.manifestType || "delivery",
      target_eta: params.targetEta || null,
      invoice_number: params.invoiceNumber || null,
      invoice_date: params.invoiceDate || null,
      created_by: params.createdBy || null,
    } as any)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Log extract_created production event (best-effort)
  try {
    await supabase.from("production_events" as any).insert({
      company_id: params.companyId,
      session_id: (data as any).id,
      event_type: "extract_created",
      triggered_by: params.createdBy || null,
      metadata: { name: params.name, customer: params.customer },
    });
  } catch (_) { /* best-effort */ }

  return data as unknown as ExtractSession;
}

export async function uploadExtractFile(params: {
  sessionId: string;
  companyId: string;
  file: File;
}): Promise<{ fileId: string; fileUrl: string; storagePath: string }> {
  const storagePath = `manifests/${Date.now()}_${params.file.name.replace(/\s+/g, "_")}`;

  const { error: uploadErr } = await supabase.storage
    .from("estimation-files")
    .upload(storagePath, params.file, {
      upsert: true,
      contentType: params.file.type,
    });

  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

  const fileUrl = await getSignedFileUrl(storagePath);

  const { data, error } = await supabase
    .from("extract_raw_files")
    .insert({
      session_id: params.sessionId,
      company_id: params.companyId,
      file_name: params.file.name,
      file_url: fileUrl,
      file_type: params.file.name.split(".").pop()?.toLowerCase() || "bin",
      file_size_bytes: params.file.size,
      storage_path: storagePath,
      status: "pending",
    } as any)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { fileId: (data as any).id, fileUrl, storagePath };
}

export async function runExtract(params: {
  sessionId: string;
  fileUrl: string;
  fileName: string;
  manifestContext: {
    name: string;
    customer: string;
    address: string;
    type: string;
  };
}): Promise<void> {
  // Update session to extracting client-side first as a safety net
  await supabase
    .from("extract_sessions")
    .update({ status: "extracting", progress: 0 } as any)
    .eq("id", params.sessionId);

  // Use project-standard invokeEdgeFunction for reliable error bodies & timeout
  const data = await invokeEdgeFunction("extract-manifest", {
    sessionId: params.sessionId,
    fileUrl: params.fileUrl,
    fileName: params.fileName,
    manifestContext: params.manifestContext,
  }, { timeoutMs: 120_000, retries: 1 });

  if (data?.status === "error") {
    console.error("Extract returned error:", data.error);
    throw new Error(data.error || "Extraction failed");
  }
}

export interface DuplicatePreviewItem {
  duplicate_key: string;
  survivor_mark: string;
  survivor_row_index: number;
  absorbed_count: number;
  original_qty: number;
  new_qty: number;
  absorbed_rows: Array<{ row_index: number; mark: string; quantity: number }>;
}

export interface DedupeResult {
  duplicates_found: number;
  rows_merged: number;
  total_active_rows: number;
  dry_run?: boolean;
  preview?: DuplicatePreviewItem[];
}

export async function detectDuplicates(sessionId: string, dryRun: boolean = false): Promise<DedupeResult> {
  const { data, error } = await supabase.functions.invoke("manage-extract", {
    body: { action: "detect-duplicates", sessionId, dryRun },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return {
    duplicates_found: data?.duplicates_found ?? 0,
    rows_merged: data?.rows_merged ?? 0,
    total_active_rows: data?.total_active_rows ?? 0,
    dry_run: data?.dry_run ?? false,
    preview: data?.preview ?? [],
  };
}

export async function applyMapping(sessionId: string, unitSystem?: string) {
  const { data, error } = await supabase.functions.invoke("manage-extract", {
    body: { action: "apply-mapping", sessionId, unitSystem },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function validateExtract(sessionId: string) {
  const { data, error } = await supabase.functions.invoke("manage-extract", {
    body: { action: "validate", sessionId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function approveExtract(sessionId: string, optimizerConfig?: {
  stockLengthMm?: number;
  kerfMm?: number;
  selectedMode?: string;
}) {
  const { data, error } = await supabase.functions.invoke("manage-extract", {
    body: { action: "approve", sessionId, optimizerConfig },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function rejectExtract(sessionId: string, reason?: string) {
  const { data, error } = await supabase.functions.invoke("manage-extract", {
    body: { action: "reject", sessionId, reason },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function fetchExtractRows(sessionId: string): Promise<ExtractRow[]> {
  const { data, error } = await supabase
    .from("extract_rows")
    .select("*")
    .eq("session_id", sessionId)
    .order("row_index");

  if (error) throw new Error(error.message);
  return (data || []) as unknown as ExtractRow[];
}

export async function fetchExtractErrors(sessionId: string): Promise<ExtractError[]> {
  const { data, error } = await supabase
    .from("extract_errors")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at");

  if (error) throw new Error(error.message);
  return (data || []) as unknown as ExtractError[];
}

export async function fetchExtractSessions(): Promise<ExtractSession[]> {
  const { data, error } = await supabase
    .from("extract_sessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as unknown as ExtractSession[];
}
