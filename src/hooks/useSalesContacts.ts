import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";
import { toast } from "sonner";

export type SalesContact = {
  id: string;
  company_id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function useSalesContacts() {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["sales_contacts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_contacts")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SalesContact[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<SalesContact> & { name: string }) => {
      const { data, error } = await supabase
        .from("sales_contacts")
        .insert({ ...item, company_id: companyId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales_contacts", companyId] }); toast.success("Contact created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SalesContact> & { id: string }) => {
      const { error } = await supabase.from("sales_contacts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales_contacts", companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales_contacts", companyId] }); toast.success("Contact deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { contacts: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}
