import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";
import { useEffect } from "react";
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
      const [systemRes, manualRes, custRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone, created_at, updated_at, customer_id, customers(company_name)")
          .eq("company_id", companyId!),
        supabase
          .from("sales_contacts")
          .select("*")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("v_customers_clean" as any)
          .select("*")
          .eq("company_id", companyId!),
      ]);

      if (systemRes.error) throw systemRes.error;
      if (manualRes.error) throw manualRes.error;
      if (custRes.error) throw custRes.error;

      const systemContacts: SalesContact[] = (systemRes.data ?? []).map((c: any) => ({
        id: c.id,
        company_id: companyId!,
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
        company_name: c.customers?.company_name ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        source: "system",
        notes: null,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));

      const manualContacts: SalesContact[] = (manualRes.data ?? []) as SalesContact[];

      const customerContacts: SalesContact[] = ((custRes.data as any[]) ?? []).map((c: any) => ({
        id: c.customer_id ?? c.id,
        company_id: companyId!,
        name: c.display_name || c.company_name || c.normalized_name || "—",
        company_name: c.company_name ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        source: "customer",
        notes: null,
        created_at: c.created_at ?? new Date().toISOString(),
        updated_at: c.created_at ?? new Date().toISOString(),
      }));

      // Dedupe by email — manual > system > customer; also dedupe by name for non-email entries
      const seen = new Set<string>();
      const seenNames = new Set<string>();
      const merged: SalesContact[] = [];

      for (const c of manualContacts) {
        if (c.email) seen.add(c.email.toLowerCase());
        if (c.name) seenNames.add(c.name.toLowerCase());
        merged.push(c);
      }
      for (const c of systemContacts) {
        if (c.email && seen.has(c.email.toLowerCase())) continue;
        if (c.email) seen.add(c.email.toLowerCase());
        if (c.name) seenNames.add(c.name.toLowerCase());
        merged.push(c);
      }
      for (const c of customerContacts) {
        if (c.email && seen.has(c.email.toLowerCase())) continue;
        if (!c.email && c.name && seenNames.has(c.name.toLowerCase())) continue;
        merged.push(c);
      }

      return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  // Realtime
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("sales_contacts_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_contacts" }, () => {
        qc.invalidateQueries({ queryKey: ["sales_contacts", companyId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, qc]);

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
