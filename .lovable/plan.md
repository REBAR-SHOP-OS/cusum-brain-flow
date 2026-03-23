

## Add `investigate_entity` Tool + Enhanced Intelligence Protocol

### What This Does

Adds a powerful cross-domain search tool that lets Vizzy investigate any project, customer, person, or keyword across ALL business data — emails, pipeline, orders, calls, production, financials, deliveries, and QuickBooks records. Also enhances Vizzy's system prompt to proactively plan next day and always use real tools before answering.

### File: `supabase/functions/admin-chat/index.ts`

---

### Change 1: Tool Definition (after line 663, before closing `]`)

New `investigate_entity` tool in `JARVIS_TOOLS`:
- `query` (required) — keyword to search (e.g. "Construction Point", "Neel", "BMO")
- `date_from` / `date_to` (optional)
- `include` (optional array: customers, leads, orders, emails, activity, deliveries, production, financials, calls)

### Change 2: Handler (before `default:` at line 1560)

Two-pass search:

**Pass 1 — Parallel identity resolution:**
- `customers` → ilike name/company_name
- `leads` → ilike title/contact_name/description  
- `communications` → ilike subject/body_preview/from_address/to_address (limit 100, 800-char previews)
- `activity_events` → ilike description (limit 100)
- `deliveries` → ilike delivery_number/notes
- `cut_plans` → ilike name
- `accounting_mirror` → search data JSONB for customer/vendor name match
- RingCentral calls → filter from communications where source=ringcentral and addresses match query

**Pass 2 — Cross-reference:**
- Use matched customer IDs to pull their orders
- Use matched lead contact emails to pull additional communications
- Group communications by `thread_id` for conversation view
- Pull QuickBooks invoices/bills from `accounting_mirror` matching customer names
- Return unified report with counts + details per domain

### Change 3: System Prompt Enhancement (after line 2145)

Add to capabilities and tool usage rules:

```text
DEEP INVESTIGATION:
- investigate_entity: Search ANY project, customer, or keyword across ALL data
- deep_business_scan: Broad multi-day business audit across all domains
- ALWAYS use investigate_entity when asked about a specific project/customer/person
- ALWAYS use deep_business_scan when asked for broad business overview

NEXT DAY PLANNING:
- When greeting CEO or at end of day, proactively plan tomorrow
- Use deep_business_scan to identify: pending deliveries, overdue invoices, hot leads, scheduled production
- Present as prioritized action list

INTEGRATION AWARENESS:
- Use ALL available tools to gather real data — NEVER fabricate
- If a tool returns empty/error, say so explicitly — NEVER hallucinate content
- Call investigate_entity or deep_business_scan BEFORE answering questions about projects or operations
```

Add `investigate_entity` and `deep_business_scan` to the tool usage rules list (line 2140-2141).

### Change 4: Progress Labels (line 2291)

Add:
- `investigate_entity: "investigating entity"`
- `deep_business_scan: "scanning business"`

---

### Files Changed

| File | Change | Category |
|---|---|---|
| `supabase/functions/admin-chat/index.ts` | Tool def + handler + prompt + progress labels | Safe additive |

### What is NOT Changed
- `deep_business_scan` handler unchanged
- No schema changes
- No new edge functions
- Existing tools unaffected

