/**
 * Embed Documents — generates vector embeddings for business records.
 * Supports batch processing: indexes leads, invoices, orders, machine logs, etc.
 * Uses Gemini text-embedding-004 (768 dimensions).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIM = 768;
const BATCH_SIZE = 20;

interface EmbedRequest {
  /** Which domain to index: sales, accounting, shopfloor, delivery, support, etc. */
  domain: string;
  /** Optional: only index specific entity type */
  entityType?: string;
  /** Optional: company_id override */
  companyId?: string;
  /** Optional: only index records updated since this timestamp */
  since?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { domain, entityType, companyId, since } = await req.json() as EmbedRequest;
    
    if (!domain) {
      return new Response(JSON.stringify({ error: "domain required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const company = companyId || "a0000000-0000-0000-0000-000000000001";

    // Fetch records to embed based on domain
    const records = await fetchRecordsForDomain(supabase, domain, entityType, company, since);
    
    if (records.length === 0) {
      return new Response(JSON.stringify({ embedded: 0, message: "No new records to embed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process in batches
    let embedded = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const texts = batch.map(r => r.content);

      try {
        const embeddings = await generateEmbeddings(geminiKey, texts);

        const rows = batch.map((r, idx) => ({
          company_id: company,
          agent_domain: domain,
          entity_type: r.entityType,
          entity_id: r.entityId,
          content_text: r.content,
          embedding: `[${embeddings[idx].join(",")}]`,
          metadata: r.metadata || {},
        }));

        const { error } = await supabase
          .from("document_embeddings")
          .upsert(rows, { onConflict: "agent_domain,entity_type,entity_id", ignoreDuplicates: false });

        if (error) {
          console.error("Upsert error:", error);
          errors += batch.length;
        } else {
          embedded += batch.length;
        }
      } catch (e) {
        console.error("Batch embedding error:", e);
        errors += batch.length;
      }
    }

    return new Response(JSON.stringify({ embedded, errors, total: records.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("embed-documents error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Embedding generation via Gemini ───
async function generateEmbeddings(apiKey: string, texts: string[]): Promise<number[][]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`;

  const requests = texts.map(text => ({
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text: text.slice(0, 2048) }] },
    taskType: "RETRIEVAL_DOCUMENT",
    outputDimensionality: EMBEDDING_DIM,
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding API error: ${response.status} — ${errText}`);
  }

  const data = await response.json();
  return data.embeddings.map((e: { values: number[] }) => e.values);
}

// ─── Domain-specific record fetching ───
interface EmbedRecord {
  entityType: string;
  entityId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

async function fetchRecordsForDomain(
  supabase: ReturnType<typeof createClient>,
  domain: string,
  entityType: string | undefined,
  companyId: string,
  since?: string,
): Promise<EmbedRecord[]> {
  const records: EmbedRecord[] = [];

  const domainFetchers: Record<string, () => Promise<void>> = {
    sales: async () => {
      if (!entityType || entityType === "lead") {
        let query = supabase.from("leads").select("id, title, stage, source, notes, expected_value, created_at")
          .eq("company_id", companyId).limit(200);
        if (since) query = query.gte("updated_at", since);
        const { data } = await query;
        if (data) {
          for (const r of data) {
            records.push({
              entityType: "lead",
              entityId: r.id,
              content: `Lead: ${r.company_name || ""} | Contact: ${r.contact_name || ""} | Stage: ${r.stage} | Source: ${r.source || ""} | Value: $${r.total_value || 0} | Notes: ${r.notes || ""}`,
              metadata: { stage: r.stage, value: r.total_value, created_at: r.created_at },
            });
          }
        }
      }
    },

    accounting: async () => {
      if (!entityType || entityType === "invoice") {
        let query = supabase.from("accounting_mirror").select("id, quickbooks_id, entity_type, balance, data, created_at")
          .eq("company_id", companyId).eq("entity_type", "Invoice").limit(200);
        if (since) query = query.gte("created_at", since);
        const { data } = await query;
        if (data) {
          for (const r of data) {
            const d = r.data as Record<string, unknown>;
            records.push({
              entityType: "invoice",
              entityId: r.id,
              content: `Invoice QB#${r.quickbooks_id} | Customer: ${d?.CustomerRef?.name || ""} | Balance: $${r.balance || 0} | Total: $${d?.TotalAmt || 0} | Due: ${d?.DueDate || ""}`,
              metadata: { balance: r.balance, quickbooks_id: r.quickbooks_id },
            });
          }
        }
      }
    },

    shopfloor: async () => {
      if (!entityType || entityType === "work_order") {
        let query = supabase.from("work_orders").select("id, order_id, status, priority, notes, created_at")
          .eq("company_id", companyId).limit(200);
        if (since) query = query.gte("updated_at", since);
        const { data } = await query;
        if (data) {
          for (const r of data) {
            records.push({
              entityType: "work_order",
              entityId: r.id,
              content: `Work Order ${r.id} | Status: ${r.status} | Priority: ${r.priority || "normal"} | Notes: ${r.notes || ""}`,
              metadata: { status: r.status, priority: r.priority },
            });
          }
        }
      }
    },

    delivery: async () => {
      if (!entityType || entityType === "delivery") {
        let query = supabase.from("deliveries").select("id, delivery_number, status, scheduled_date, driver_name, vehicle_plate, notes, created_at")
          .eq("company_id", companyId).limit(200);
        if (since) query = query.gte("updated_at", since);
        const { data } = await query;
        if (data) {
          for (const r of data) {
            records.push({
              entityType: "delivery",
              entityId: r.id,
              content: `Delivery ${r.delivery_number || r.id} | Status: ${r.status} | Date: ${r.scheduled_date || ""} | Driver: ${r.driver_name || ""} | Vehicle: ${r.vehicle_plate || ""} | Notes: ${r.notes || ""}`,
              metadata: { status: r.status, scheduled_date: r.scheduled_date },
            });
          }
        }
      }
    },

    support: async () => {
      if (!entityType || entityType === "ticket") {
        let query = supabase.from("support_conversations").select("id, visitor_name, visitor_email, status, subject, created_at")
          .eq("company_id", companyId).limit(200);
        if (since) query = query.gte("created_at", since);
        const { data } = await query;
        if (data) {
          for (const r of data) {
            records.push({
              entityType: "ticket",
              entityId: r.id,
              content: `Support ticket from ${r.visitor_name || r.visitor_email || "unknown"} | Status: ${r.status} | Subject: ${r.subject || "General inquiry"}`,
              metadata: { status: r.status },
            });
          }
        }
      }
    },
  };

  const fetcher = domainFetchers[domain];
  if (fetcher) {
    await fetcher();
  } else {
    console.warn(`No fetcher defined for domain: ${domain}`);
  }

  return records;
}
