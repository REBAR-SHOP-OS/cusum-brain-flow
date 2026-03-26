

# Fix: AI-Generated Quotations Not Appearing in List

## Problem
The AI quotation was successfully created (QAI-2612 in the `quotes` table with `source: "ai_estimation"`), but the quotation list filters by `source = "odoo_sync"` only, so AI-generated quotes are invisible.

## Root Cause
`useArchivedQuotations.ts` line 25:
```ts
.eq("source", "odoo_sync")
```
This hard filter excludes any quotation with a different source (like `"ai_estimation"` or `"quote_engine"`).

## Fix

### File: `src/hooks/useArchivedQuotations.ts` (line 25)

Remove the `.eq("source", "odoo_sync")` filter so ALL quotations from the `quotes` table are shown, regardless of source.

```ts
// Before
let query = supabase
  .from("quotes")
  .select("*", { count: "exact" })
  .eq("source", "odoo_sync");

// After
let query = supabase
  .from("quotes")
  .select("*", { count: "exact" });
```

### File: `src/components/accounting/GenerateQuotationDialog.tsx`

Fix the query key invalidation (from previous plan) — ensure after AI generation it invalidates `["archived-quotations"]` (with hyphen) to refresh the list.

## Result
All quotations (Odoo-synced, AI-generated, quote-engine) appear in the quotation tab. The existing search and status filters still work.

## Files Changed
- `src/hooks/useArchivedQuotations.ts` — remove `odoo_sync` source filter
- `src/components/accounting/GenerateQuotationDialog.tsx` — fix query key invalidation

