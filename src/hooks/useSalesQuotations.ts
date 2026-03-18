import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";
import { getCompanyId } from "./useCompanyId";
import { toast } from "sonner";

// ─── State Machine Definition ───

export const QUOTE_STATUSES = [
  { id: "draft", label: "Draft", color: "bg-muted text-muted-foreground" },
  { id: "pricing_in_progress", label: "Pricing...", color: "bg-yellow-500/10 text-yellow-700 border-yellow-400" },
  { id: "pricing_failed", label: "Pricing Failed", color: "bg-red-500/10 text-red-700 border-red-400" },
  { id: "quote_ready", label: "Quote Ready", color: "bg-sky-500/10 text-sky-600 border-sky-300" },
  { id: "awaiting_internal_review", label: "Internal Review", color: "bg-purple-500/10 text-purple-600 border-purple-300" },
  { id: "internal_revision_requested", label: "Revision Requested", color: "bg-orange-500/10 text-orange-600 border-orange-300" },
  { id: "internally_approved", label: "Approved", color: "bg-emerald-500/10 text-emerald-700 border-emerald-400" },
  { id: "sent_to_customer", label: "Sent to Customer", color: "bg-blue-500/10 text-blue-600 border-blue-300" },
  { id: "customer_approved", label: "Customer Approved", color: "bg-green-500/10 text-green-700 border-green-400" },
  { id: "customer_revision_requested", label: "Customer Revision", color: "bg-orange-500/10 text-orange-600 border-orange-300" },
  { id: "customer_rejected", label: "Rejected", color: "bg-red-500/10 text-red-700 border-red-400" },
  { id: "expired", label: "Expired", color: "bg-yellow-500/10 text-yellow-700 border-yellow-400" },
  { id: "cancelled", label: "Cancelled", color: "bg-muted text-muted-foreground line-through" },
  // Legacy compat
  { id: "sent", label: "Sent", color: "bg-blue-500/10 text-blue-600 border-blue-300" },
  { id: "accepted", label: "Accepted", color: "bg-green-500/10 text-green-700 border-green-400" },
  { id: "declined", label: "Declined", color: "bg-red-500/10 text-red-700 border-red-400" },
] as const;

export const QUOTE_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:                        ["pricing_in_progress", "pricing_failed", "quote_ready", "expired", "cancelled"],
  pricing_in_progress:          ["quote_ready", "pricing_failed", "cancelled"],
  pricing_failed:               ["draft", "pricing_in_progress", "cancelled"],
  quote_ready:                  ["awaiting_internal_review", "expired", "cancelled"],
  awaiting_internal_review:     ["internally_approved", "internal_revision_requested", "expired", "cancelled"],
  internal_revision_requested:  ["draft", "cancelled"],
  internally_approved:          ["sent_to_customer", "expired", "cancelled"],
  sent_to_customer:             ["customer_approved", "customer_revision_requested", "customer_rejected", "expired", "cancelled"],
  customer_approved:            [],
  customer_revision_requested:  ["draft", "cancelled"],
  customer_rejected:            [],
  expired:                      ["draft", "cancelled"],
  cancelled:                    [],
  // Legacy compat
  sent:                         ["accepted", "declined"],
  accepted:                     [],
  declined:                     [],
};

export function getStatusInfo(status: string) {
  return QUOTE_STATUSES.find(s => s.id === status) || { id: status, label: status, color: "bg-muted text-muted-foreground" };
}

export function canTransitionTo(currentStatus: string, targetStatus: string): boolean {
  const allowed = QUOTE_ALLOWED_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(targetStatus) : false;
}

export function getAvailableTransitions(currentStatus: string): string[] {
  return QUOTE_ALLOWED_TRANSITIONS[currentStatus] || [];
}

// ─── Types ───

export type SalesQuotation = {
  id: string;
  company_id: string;
  quotation_number: string;
  customer_name: string | null;
  customer_company: string | null;
  sales_lead_id: string | null;
  status: string;
  amount: number | null;
  notes: string | null;
  created_at: string;
  expiry_date: string | null;
  // New state machine fields
  version_number: number;
  parent_version_id: string | null;
  updated_at: string;
  updated_by: string | null;
  pricing_status: string;
  pricing_failure_reason: string | null;
  pricing_failure_details: Record<string, unknown> | null;
  estimate_request: Record<string, unknown> | null;
  quote_result: Record<string, unknown> | null;
  total_tonnage: number | null;
  scrap_percent: number | null;
  tonnage_bracket: string | null;
  internal_approved_at: string | null;
  internal_approved_by: string | null;
  internal_approval_note: string | null;
  pdf_generated_at: string | null;
  pdf_version: number | null;
  pdf_viewed_internally: boolean;
  pdf_viewed_by_customer: boolean;
  customer_approved_at: string | null;
  customer_approved_by: string | null;
  customer_approval_version: number | null;
  valid_until: string | null;
  revision_reason: string | null;
  line_items: any[] | null;
  assumptions: any[] | null;
  source: string | null;
};

/**
 * Generate next quotation number in format Q{YYYY}{0001}.
 */
export async function generateQuotationNumber(companyId?: string | null): Promise<string> {
  const cid = companyId ?? (await getCompanyId());
  const year = new Date().getFullYear();
  const prefix = `Q${year}`;

  if (!cid) return `${prefix}0001`;

  const { data } = await supabase
    .from("sales_quotations")
    .select("quotation_number")
    .eq("company_id", cid)
    .like("quotation_number", `${prefix}%`)
    .order("quotation_number", { ascending: false })
    .limit(1);

  if (!data?.length) return `${prefix}0001`;

  const lastNum = parseInt(data[0].quotation_number.slice(prefix.length), 10) || 0;
  return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
}

// ─── Hook ───

export function useSalesQuotations() {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["sales_quotations", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_quotations")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SalesQuotation[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<SalesQuotation> & { quotation_number: string }) => {
      const { data, error } = await supabase
        .from("sales_quotations")
        .insert({ ...item, company_id: companyId! } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales_quotations", companyId] }); toast.success("Quotation created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SalesQuotation> & { id: string }) => {
      // Client-side state machine enforcement
      if (updates.status) {
        const current = query.data?.find(q => q.id === id);
        if (current && !canTransitionTo(current.status, updates.status)) {
          throw new Error(`Cannot transition from "${current.status}" to "${updates.status}". Allowed: ${getAvailableTransitions(current.status).join(", ") || "none"}`);
        }
      }
      const { error } = await supabase.from("sales_quotations").update(updates as any).eq("id", id);
      if (error) {
        // Parse DB trigger errors for user-friendly messages
        if (error.message.includes("Invalid quotation status transition")) {
          throw new Error(error.message.replace("new row for relation \"sales_quotations\" violates check constraint", "").trim());
        }
        if (error.message.includes("Cannot approve quotation with $0")) {
          throw new Error("Cannot approve: quotation has $0 amount. Pricing must succeed first.");
        }
        if (error.message.includes("must view the PDF")) {
          throw new Error(error.message);
        }
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales_quotations", companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_quotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales_quotations", companyId] }); toast.success("Quotation deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Log audit event
  const logAuditEvent = useMutation({
    mutationFn: async (event: { quotation_id: string; event_type: string; previous_value?: string; new_value?: string; notes?: string; metadata?: Record<string, unknown> }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase.from("quote_audit_log").insert({
        quotation_id: event.quotation_id,
        event_type: event.event_type,
        previous_value: event.previous_value || null,
        new_value: event.new_value || null,
        notes: event.notes || null,
        metadata: (event.metadata || null) as any,
        company_id: companyId!,
        performed_by: user?.id || null,
      } as any);
      if (error) throw error;
    },
  });

  // Fetch audit log for a quotation
  const fetchAuditLog = async (quotationId: string) => {
    const { data, error } = await supabase
      .from("quote_audit_log")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data;
  };

  return {
    quotations: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
    logAuditEvent,
    fetchAuditLog,
    generateNumber: () => generateQuotationNumber(companyId),
  };
}
