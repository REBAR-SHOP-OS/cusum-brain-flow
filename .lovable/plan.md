

# Fix: Security Findings Remediation

## Issues to Fix

### 1. Extension in Public Schema (2 warnings)
`pg_net` and `vector` extensions are installed in the `public` schema instead of the recommended `extensions` schema.

**Fix:** Move both extensions to the `extensions` schema with proper search path configuration.

### 2. Overly Permissive RLS on `document_embeddings` (critical)
The "Service role can manage embeddings" policy grants ALL access to the **public** (anonymous) role with `USING(true)`. This means unauthenticated users can insert, update, and delete embeddings. It should be restricted to `service_role`.

**Fix:** Drop the misconfigured policy and recreate it for `service_role` only.

### 3. Mark Outdated Scan Results as Current
After applying fixes, re-run the security scan and update finding statuses.

---

## Technical Details

### Migration 1: Move Extensions to `extensions` Schema

```sql
-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move vector extension
ALTER EXTENSION vector SET SCHEMA extensions;

-- Move pg_net extension  
ALTER EXTENSION pg_net SET SCHEMA extensions;

-- Grant usage so existing queries still work
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
```

### Migration 2: Fix `document_embeddings` RLS Policy

```sql
-- Drop the misconfigured policy (grants ALL to public/anon role)
DROP POLICY "Service role can manage embeddings" ON public.document_embeddings;

-- Recreate with correct role
CREATE POLICY "Service role can manage embeddings"
  ON public.document_embeddings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### Post-Fix: Re-run Security Scan
After migrations, re-run the security scan to clear the outdated findings and verify resolution.

## Risk Assessment
- Extension migration: Low risk -- only changes schema location, functions remain accessible
- RLS fix: Zero risk to app functionality -- the app uses service_role client for embeddings operations, not anonymous access
- No frontend code changes needed

