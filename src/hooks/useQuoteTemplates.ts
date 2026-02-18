import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

export interface QuoteTemplate {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  customer_type: string | null;
  default_tax_rate: number;
  default_valid_days: number;
  inclusions: string[];
  exclusions: string[];
  terms: string[];
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteTemplateItem {
  id: string;
  template_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  is_optional: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
}

export function useQuoteTemplates() {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["quote_templates", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("quote_templates")
        .select("*")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data as QuoteTemplate[];
    },
    enabled: !!companyId,
  });

  const createTemplate = useMutation({
    mutationFn: async (input: Partial<QuoteTemplate> & { items?: Omit<QuoteTemplateItem, "id" | "template_id" | "created_at">[] }) => {
      const { items, ...templateData } = input;
      const { data: { user } } = await supabase.auth.getUser();
      const { data: template, error } = await supabase
        .from("quote_templates")
        .insert({
          name: templateData.name || "Untitled",
          company_id: companyId!,
          created_by: user?.id,
          description: templateData.description,
          customer_type: templateData.customer_type,
          default_tax_rate: templateData.default_tax_rate,
          default_valid_days: templateData.default_valid_days,
          is_active: templateData.is_active,
          inclusions: templateData.inclusions,
          exclusions: templateData.exclusions,
          terms: templateData.terms,
          notes: templateData.notes,
        })
        .select()
        .single();
      if (error) throw error;

      if (items && items.length > 0) {
        const { error: itemsErr } = await supabase
          .from("quote_template_items")
          .insert(items.map((item, idx) => ({ ...item, template_id: template.id, sort_order: idx })));
        if (itemsErr) throw itemsErr;
      }
      return template;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quote_templates"] }); toast.success("Template created"); },
    onError: (e) => toast.error(e.message),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<QuoteTemplate> & { id: string }) => {
      const { error } = await supabase.from("quote_templates").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quote_templates"] }); toast.success("Template updated"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quote_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quote_templates"] }); toast.success("Template deleted"); },
    onError: (e) => toast.error(e.message),
  });

  return { templates, isLoading, createTemplate, updateTemplate, deleteTemplate };
}

export function useQuoteTemplateItems(templateId: string | null) {
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["quote_template_items", templateId],
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await supabase
        .from("quote_template_items")
        .select("*")
        .eq("template_id", templateId)
        .order("sort_order");
      if (error) throw error;
      return data as QuoteTemplateItem[];
    },
    enabled: !!templateId,
  });

  const upsertItems = useMutation({
    mutationFn: async ({ templateId: tId, items: newItems }: { templateId: string; items: Omit<QuoteTemplateItem, "id" | "template_id" | "created_at">[] }) => {
      // Delete existing and re-insert
      await supabase.from("quote_template_items").delete().eq("template_id", tId);
      if (newItems.length > 0) {
        const { error } = await supabase
          .from("quote_template_items")
          .insert(newItems.map((item, idx) => ({ ...item, template_id: tId, sort_order: idx })));
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["quote_template_items", vars.templateId] }); toast.success("Line items saved"); },
    onError: (e) => toast.error(e.message),
  });

  const totalRequired = items.filter(i => !i.is_optional).reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const totalOptional = items.filter(i => i.is_optional).reduce((s, i) => s + i.quantity * i.unit_price, 0);

  return { items, isLoading, upsertItems, totalRequired, totalOptional };
}
