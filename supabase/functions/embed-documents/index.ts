import { handleRequest } from "../_shared/requestHandler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIM = 768;
const BATCH_SIZE = 20;

interface EmbedRequest {
  domain: string;
  entityType?: string;
  companyId?: string;
  since?: string;
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { serviceClient: supabase, body } = ctx;
    const { domain, entityType, companyId, since } = body as EmbedRequest;

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

    const company = companyId || "a0000000-0000-0000-0000-000000000001";

    const records = await fetchRecordsForDomain(supabase, domain, entityType, company, since);

    if (records.length === 0) {
      return { embedded: 0, message: "No new records to embed" };
    }

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

    return { embedded, errors, total: records.length };
  }, { functionName: "embed-documents", authMode: "none", requireCompany: false, wrapResult: false })
);

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
              content: `Lead: ${(r as any).company_name || ""} | Contact: ${(r as any).contact_name || ""} | Stage: ${r.stage} | Source: ${r.source || ""} | Value: $${(r as any).total_value || 0} | Notes: ${r.notes || ""}`,
              metadata: { stage: r.stage, value: (r as any).total_value, created_at: r.created_at },
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
              content: `Invoice QB#${r.quickbooks_id} | Customer: ${(d as any)?.CustomerRef?.name || ""} | Balance: $${r.balance || 0} | Total: $${(d as any)?.TotalAmt || 0} | Due: ${(d as any)?.DueDate || ""}`,
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
