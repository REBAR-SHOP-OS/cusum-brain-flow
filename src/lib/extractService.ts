import { supabase } from "@/integrations/supabase/client";

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
  status: string;
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

// ── Service Functions ────────────────────────────────────────

export async function createExtractSession(params: {
  companyId: string;
  name: string;
  customer?: string;
  siteAddress?: string;
  manifestType?: string;
  targetEta?: string;
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
      created_by: params.createdBy || null,
    } as any)
    .select()
    .single();

  if (error) throw new Error(error.message);
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

  const { getSignedFileUrl } = await import("@/lib/storageUtils");
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
}): Promise<{ items: any[]; summary: any }> {
  // Update session status
  await supabase
    .from("extract_sessions")
    .update({ status: "extracting" } as any)
    .eq("id", params.sessionId);

  // Call AI extraction
  const { data, error } = await supabase.functions.invoke("extract-manifest", {
    body: {
      fileUrl: params.fileUrl,
      fileName: params.fileName,
      manifestContext: params.manifestContext,
    },
  });

  if (error) throw new Error(error.message || "Extraction failed");
  if (data?.error) throw new Error(data.error);

  const items = data?.items || [];

  // Save extracted rows to DB
  if (items.length > 0) {
    const rows = items.map((item: any, idx: number) => ({
      session_id: params.sessionId,
      row_index: idx + 1,
      dwg: item.dwg || null,
      item_number: String(item.item || idx + 1),
      grade: item.grade || null,
      mark: item.mark || null,
      quantity: item.quantity || 0,
      bar_size: item.size || null,
      shape_type: item.type || null,
      total_length_mm: item.total_length || null,
      dim_a: item.A || null,
      dim_b: item.B || null,
      dim_c: item.C || null,
      dim_d: item.D || null,
      dim_e: item.E || null,
      dim_f: item.F || null,
      dim_g: item.G || null,
      dim_h: item.H || null,
      dim_j: item.J || null,
      dim_k: item.K || null,
      dim_o: item.O || null,
      dim_r: item.R || null,
      weight_kg: item.weight || null,
      customer: item.customer || null,
      reference: item.ref || null,
      address: item.address || null,
      status: "raw",
    }));

    await supabase.from("extract_rows").insert(rows as any);
  }

  // Update session status
  await supabase
    .from("extract_sessions")
    .update({ status: "extracted" } as any)
    .eq("id", params.sessionId);

  return { items, summary: data?.summary };
}

export async function applyMapping(sessionId: string) {
  const { data, error } = await supabase.functions.invoke("manage-extract", {
    body: { action: "apply-mapping", sessionId },
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

export async function approveExtract(sessionId: string) {
  const { data, error } = await supabase.functions.invoke("manage-extract", {
    body: { action: "approve", sessionId },
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
