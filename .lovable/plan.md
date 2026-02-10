

## Give Blitz Full Read-Only Access to Odoo

### The Problem
Blitz currently only sees pre-processed stats built client-side from already-synced leads in the database. It cannot query Odoo directly, so it misses real-time data, quotation details, activities, or any Odoo model not yet synced.

### The Solution
Add Odoo read-only query capability directly into the `pipeline-ai` edge function. When Blitz needs data to answer a question, it will query Odoo in real-time using the existing credentials (ODOO_URL, ODOO_API_KEY, ODOO_DATABASE, ODOO_USERNAME -- all already configured).

### What Changes

**File: `supabase/functions/pipeline-ai/index.ts`**

1. Add `odooAuthenticate()` and `odooSearchRead()` helpers (reuse the proven pattern from `sync-odoo-leads`)
2. Before calling the AI, fetch a rich Odoo snapshot:
   - `crm.lead` -- all active opportunities (name, stage, salesperson, revenue, probability, partner, dates, priority)
   - `sale.order` -- recent quotations (name, partner, amount, state, date)
   - `crm.lead` activity summary (last activity dates)
3. Inject this Odoo data into the AI prompt alongside the existing pipeline stats
4. Cap data at reasonable limits (500 leads, 200 quotations) to stay within token limits

**File: `src/components/pipeline/PipelineAISheet.tsx`**

5. No changes needed -- the edge function will enrich the context server-side

### How It Works

```text
User asks Blitz a question
        |
        v
PipelineAISheet sends request to pipeline-ai edge function
        |
        v
pipeline-ai authenticates with Odoo (XML-RPC)
        |
        v
Fetches live crm.lead + sale.order data (JSON-RPC)
        |
        v
Combines: DB pipeline stats + live Odoo data + user question
        |
        v
Sends enriched prompt to AI model
        |
        v
Returns detailed, data-backed answer to Blitz UI
```

### Technical Details

The Odoo query in `pipeline-ai` will fetch these fields:

**crm.lead (up to 500):**
- id, name, stage_id, partner_id, contact_name, email_from, phone, expected_revenue, probability, date_deadline, user_id, priority, create_date, write_date, type

**sale.order (up to 200):**
- id, name, partner_id, amount_total, state, date_order, user_id, validity_date

The data is serialized as JSON and appended to the system prompt under an "ODOO LIVE DATA" section. The AI can then reference specific leads by name, salesperson, value, and stage when answering questions.

### Security
- Read-only access only (search_read operations)
- Credentials stay server-side in the edge function (never exposed to client)
- User authentication is still required via the Authorization header

### Scope
- Only `supabase/functions/pipeline-ai/index.ts` is modified
- No UI, CSS, layout, or other component changes
- No changes to any other edge functions

