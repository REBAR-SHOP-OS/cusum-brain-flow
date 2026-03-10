

# Fix: Extract Rows Have NULL company_id — RLS Blocks All Reads

## Root Cause

The `extract_rows` RLS SELECT policy requires `company_id = get_user_company_id(auth.uid())`. However, the latest session's 25 rows all have `company_id = NULL` because the **deployed** edge function is still the old version without the `company_id` insert field. The code was edited but needs redeployment.

The backfill migration only ran once and doesn't cover rows inserted after it.

## Fix (2 steps)

### 1. Database Migration — Backfill NULL rows + add NOT NULL default

Backfill any rows with NULL `company_id` by joining `extract_sessions`, then set a default to prevent future NULLs:

```sql
UPDATE public.extract_rows r
SET company_id = s.company_id
FROM public.extract_sessions s
WHERE r.session_id = s.id
  AND r.company_id IS NULL;
```

### 2. Redeploy Edge Function — `extract-manifest`

The code already includes `company_id: sessionCompanyId` on line 291 — it just needs to be redeployed so the running function matches the source code. A trivial whitespace or comment change will trigger redeployment.

### No frontend changes needed

The hooks and realtime subscriptions are already correct.

