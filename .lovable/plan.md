

# Fix Plan: Video Generation Error + Migration Pipeline Blocker

## Two Issues

### Issue 1: Video Generation 404 Error (Root Cause)
The edge function logs show:
```
Veo submit error: 404
models/veo-3.0-generate-preview is not found for API version v1beta,
or is not supported for predictLongRunning
```

The model `veo-3.0-generate-preview` no longer exists. Per Google's official docs (verified today), the correct model is **`veo-3.1-generate-preview`**. Additionally, the polling response structure changed from `response.generatedSamples` to `response.generateVideoResponse.generatedSamples`.

**File: `supabase/functions/generate-video/index.ts`**
- Change model from `veo-3.0-generate-preview` to `veo-3.1-generate-preview`
- Update `veoGenerate`: use `x-goog-api-key` header instead of `?key=` query param (per official REST docs)
- Update `veoPoll`: fix response parsing to use `response.generateVideoResponse.generatedSamples`
- Update video download URL to use header-based auth
- Constrain duration to valid values: 4, 6, or 8 seconds (Veo 3.1 requirement)

### Issue 2: Migration Pipeline Blocker
Migration `20260304234951` runs `CREATE UNIQUE INDEX idx_leads_odoo_id_unique` without deduplication. Production has duplicate `odoo_id` values (e.g., key `3083`), so it fails. All fix migrations (`20260305*`) come AFTER in the chain and never execute.

**Fix: Modify `20260304234951` to include dedup before index creation.** Since this migration has NOT been applied on production (it's the one failing), modifying it is safe. On dev/preview where it already ran, we add `IF NOT EXISTS` to prevent errors.

**File: `supabase/migrations/20260304234951_f3b11fd1-92a6-4b57-a45e-2967837649e5.sql`**
- Add dedup DELETE before the CREATE INDEX
- Add `DROP INDEX IF EXISTS` before CREATE to handle dev environments
- Convert the 5 redundant fix migrations (`20260305031029`, `20260305144441`, `20260305150909`, `20260305154125`, `20260305154553`, `20260305155616`) to `SELECT 1;` no-ops

| File | Change |
|---|---|
| `supabase/functions/generate-video/index.ts` | Update Veo model to `veo-3.1-generate-preview`, fix API auth headers, fix response parsing |
| `supabase/migrations/20260304234951_*.sql` | Add dedup + `DROP INDEX IF EXISTS` before CREATE |
| 5-6 redundant migration files | Convert to `SELECT 1;` |

