import { supabase } from "@/integrations/supabase/client";

// ── Types ────────────────────────────────────────────────────

export interface Project {
  id: string;
  company_id: string;
  name: string;
  customer_id: string | null;
  site_address: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Barlist {
  id: string;
  company_id: string;
  project_id: string;
  name: string;
  source_type: string;
  revision_no: number;
  status: string;
  parent_barlist_id: string | null;
  extract_session_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  project?: { name: string } | null;
}

export interface BarlistItem {
  id: string;
  barlist_id: string;
  mark: string | null;
  qty: number;
  bar_code: string | null;
  grade: string | null;
  shape_code: string | null;
  cut_length_mm: number | null;
  dims_json: Record<string, number> | null;
  weight_kg: number | null;
  drawing_ref: string | null;
  notes: string | null;
  source_row_id: string | null;
  status: string;
  created_at: string;
}

// ── Projects ─────────────────────────────────────────────────

export async function fetchProjects(companyId?: string): Promise<Project[]> {
  let query = supabase.from("projects").select("*").order("created_at", { ascending: false });
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as unknown as Project[];
}

export async function createProject(params: {
  companyId: string;
  name: string;
  customerId?: string;
  siteAddress?: string;
  createdBy?: string;
}): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      company_id: params.companyId,
      name: params.name,
      customer_id: params.customerId || null,
      site_address: params.siteAddress || null,
      created_by: params.createdBy || null,
    } as any)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Project;
}

// ── Barlists ─────────────────────────────────────────────────

export async function fetchBarlists(projectId?: string): Promise<Barlist[]> {
  let query = (supabase as any)
    .from("barlists")
    .select("*, project:projects(name)")
    .order("created_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as Barlist[];
}

export async function createBarlist(params: {
  companyId: string;
  projectId: string;
  name: string;
  sourceType?: string;
  parentBarlistId?: string;
  extractSessionId?: string;
  createdBy?: string;
}): Promise<Barlist> {
  // Determine revision number
  let revisionNo = 1;
  if (params.parentBarlistId) {
    const { data: parent } = await supabase
      .from("barlists")
      .select("revision_no")
      .eq("id", params.parentBarlistId)
      .single();
    if (parent) revisionNo = ((parent as any).revision_no || 0) + 1;
  }

  const { data, error } = await supabase
    .from("barlists")
    .insert({
      company_id: params.companyId,
      project_id: params.projectId,
      name: params.name,
      source_type: params.sourceType || "manual",
      revision_no: revisionNo,
      parent_barlist_id: params.parentBarlistId || null,
      extract_session_id: params.extractSessionId || null,
      created_by: params.createdBy || null,
    } as any)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Barlist;
}

export async function fetchBarlistItems(barlistId: string): Promise<BarlistItem[]> {
  const { data, error } = await supabase
    .from("barlist_items")
    .select("*")
    .eq("barlist_id", barlistId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data || []) as unknown as BarlistItem[];
}

// ── Events ───────────────────────────────────────────────────

export async function logBarlistEvent(
  barlistId: string,
  eventType: string,
  actorId: string,
  description?: string,
  metadata?: Record<string, unknown>
) {
  const { getCompanyId } = await import("@/hooks/useCompanyId");
  const companyId = await getCompanyId();
  await supabase.from("activity_events").insert({
    entity_type: "barlist",
    entity_id: barlistId,
    event_type: eventType,
    actor_id: actorId,
    actor_type: "user",
    description: description || eventType,
    company_id: companyId!,
    metadata: metadata || {},
    source: "system",
    dedupe_key: `barlist:${barlistId}:${eventType}`,
  } as any);
}
