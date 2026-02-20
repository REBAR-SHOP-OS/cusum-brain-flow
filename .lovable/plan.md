
# Fix: Build Error — Vector Extension Migration Conflict

## What's Actually Happening (Two Issues)

### Issue 1: Sattar's Login — NOT an App Problem
Sattar's account is completely healthy:
- Auth account: confirmed, never banned, last signed in 13:16 UTC today
- Profile: active, company correctly assigned
- Role: `admin`

The screenshot shows the **Lovable platform login screen** (not REBAR SHOP OS). The "An internal error occurred" is a Lovable.dev platform issue — likely a temporary service blip. The app itself is not the cause. Sattar should try again or clear browser cookies/cache and retry Google sign-in.

### Issue 2: Build Error — CRITICAL (Blocking Deployment)
The real problem is a migration conflict that is breaking the entire build pipeline:

```
ERROR: 2BP01: cannot drop extension vector because other objects depend on it
DETAIL: column embedding of table document_embeddings depends on type vector
        function match_documents(vector,...) depends on type vector
HINT: Use DROP ... CASCADE to drop the dependent objects too.
```

**Root cause:** When Lovable's migration diff tool runs, it detects the `vector` extension and `document_embeddings` table/function as "new" objects to create — but because the migration was already applied to the live database, Postgres rejects the re-creation attempt. The system is trying to DROP and re-CREATE the extension, but the extension cannot be dropped because the `document_embeddings` table's `embedding` column and the `match_documents` function depend on it.

This is a **migration idempotency** issue. The fix is to make the migration fully safe to re-run by:
1. Wrapping the extension creation with `CREATE EXTENSION IF NOT EXISTS vector` (already there — but the DROP is the problem)
2. Making the table creation idempotent with `CREATE TABLE IF NOT EXISTS`
3. Making the function creation use `CREATE OR REPLACE FUNCTION` (already done)
4. Making the index creations idempotent with `CREATE INDEX IF NOT EXISTS`
5. Making the trigger creation idempotent with `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`
6. Making the RLS policy creations idempotent with `DROP POLICY IF EXISTS` before `CREATE POLICY`

## Fix: Update the Migration to be Fully Idempotent

The file `supabase/migrations/20260220012124_14ad7630-a525-4125-a8ec-11ffed3c9966.sql` needs all its DDL statements hardened with `IF NOT EXISTS` / `IF EXISTS` guards so it can safely run on a database that already has these objects.

## Files Modified

- `supabase/migrations/20260220012124_14ad7630-a525-4125-a8ec-11ffed3c9966.sql` — add idempotency guards to all DDL statements
