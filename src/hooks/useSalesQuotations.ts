import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";
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

  return { quotations: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}
