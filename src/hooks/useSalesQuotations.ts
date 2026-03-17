import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";
import { getCompanyId } from "./useCompanyId";
import { toast } from "sonner";

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
};

/**
 * Generate next quotation number in format Q{YYYY}{0001}.
 * Can be used inside or outside React components.
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
        .insert({ ...item, company_id: companyId! })
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
      const { error } = await supabase.from("sales_quotations").update(updates).eq("id", id);
      if (error) throw error;
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

  return { quotations: query.data ?? [], isLoading: query.isLoading, create, update, remove, generateNumber: () => generateQuotationNumber(companyId) };
}
