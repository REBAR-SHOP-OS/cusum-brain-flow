import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";
import { toast } from "sonner";

export type SalesInvoice = {
  id: string;
  company_id: string;
  invoice_number: string;
  customer_name: string | null;
  customer_company: string | null;
  quotation_id: string | null;
  sales_lead_id: string | null;
  amount: number | null;
  status: string;
  due_date: string | null;
  issued_date: string | null;
  notes: string | null;
  created_at: string;
};

export function useSalesInvoices() {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["sales_invoices", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_invoices")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SalesInvoice[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<SalesInvoice> & { invoice_number: string }) => {
      const { data, error } = await supabase
        .from("sales_invoices")
        .insert({ ...item, company_id: companyId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales_invoices", companyId] }); toast.success("Invoice created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SalesInvoice> & { id: string }) => {
      const { error } = await supabase.from("sales_invoices").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales_invoices", companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales_invoices", companyId] }); toast.success("Invoice deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { invoices: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}
