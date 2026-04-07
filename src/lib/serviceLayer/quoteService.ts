/**
 * Quote service layer — thin wrapper around Supabase queries for quotations.
 * Purely additive. Existing components can optionally use this instead of raw queries.
 * Same inputs/outputs — zero behavior change.
 */
import { supabase } from "@/integrations/supabase/client";

export interface QuoteListOptions {
  companyId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function listQuotes(options: QuoteListOptions) {
  let query = supabase
    .from("quotes")
    .select("*", { count: "exact" })
    .eq("company_id", options.companyId)
    .order("created_at", { ascending: false });

  if (options.status) {
    query = query.eq("status", options.status);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }
  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to list quotes: ${error.message}`);
  return { quotes: data ?? [], total: count ?? 0 };
}

export async function getQuoteById(quoteId: string) {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get quote: ${error.message}`);
  return data;
}

export async function updateQuoteStatus(quoteId: string, status: string) {
  const { data, error } = await supabase
    .from("quotes")
    .update({ status, updated_at: new Date().toISOString() } as any)
    .eq("id", quoteId)
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to update quote status: ${error.message}`);
  return data;
}
