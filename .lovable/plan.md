
# Vizzy Bug Fixes After Audit Implementation

## Issues Found

### 1. Critical: `vizzy-context` edge function returns unresolved Promise
In `supabase/functions/vizzy-context/index.ts` line 49, `buildSnapshotFromContext()` is an async function but is NOT awaited. The response JSON will contain `snapshot: {}` (a serialized Promise), so the client will never get valid snapshot data.

**Fix**: Add `await` before `buildSnapshotFromContext(supabaseAdmin, user.id)`.

### 2. Critical: Broken fallback in `loadContextCached`
In `VizzyPage.tsx` lines 217-221, the fallback tries to dynamically import `useVizzyContext` (a React hook) and use it outside a React component. This will never work -- hooks can't be called outside components. The comment even says "Can't use hooks outside React, just return null for fallback."

**Fix**: Remove the dead dynamic import. If the server context fails, fall back to calling the `vizzy-context` edge function again or return null cleanly.

### 3. Medium: `vizzy-context` does redundant work
The edge function builds BOTH `contextString` (full text) via `buildFullVizzyContext` AND `snapshot` (structured object) via `buildSnapshotFromContext` -- which runs 14 additional DB queries on top of the ones already done by `buildFullVizzyContext`. The client only uses the `snapshot` field (to pass to `buildVizzyContext`).

**Fix**: Remove the `contextString` field and the `buildFullVizzyContext` call from the endpoint since the client only needs the snapshot. This cuts DB queries in half.

### 4. Minor: CORS headers missing extended Supabase headers
The `vizzy-context` CORS headers are missing the extended Supabase client headers (`x-supabase-client-platform`, etc.), which could cause preflight failures with newer Supabase JS versions.

**Fix**: Add the full CORS header set.

### 5. Minor: `sendBeacon` to REST API won't work
In `VizzyPage.tsx` lines 118-121, `navigator.sendBeacon` posts to the Supabase REST API but without the required `apikey` and `Authorization` headers. Supabase REST requires these headers, so the beacon will always fail with 401.

**Fix**: Remove the broken `sendBeacon` call. Instead, save transcript periodically (every 30 seconds) while the session is active, so crash-loss is minimized to 30s of data.

### 6. Minor: `useVizzyContext.ts` still exists but was supposed to be removed
The plan said to remove the client-side context hook, but it still exists. It's only imported for its type (`VizzyBusinessSnapshot`). The type export should be moved to a standalone types file.

**Fix**: Move `VizzyBusinessSnapshot` type to `src/types/vizzy.ts`, update imports, and delete the hook.

## Changes

### File: `supabase/functions/vizzy-context/index.ts`
- Remove `buildFullVizzyContext` import and call (saves 18 DB queries)
- `await` the `buildSnapshotFromContext` call
- Add full CORS headers
- Only return `{ snapshot }` in response

### File: `src/pages/VizzyPage.tsx`
- Remove broken dynamic import fallback in `loadContextCached` -- just return null
- Remove broken `sendBeacon` on `beforeunload`
- Add periodic transcript auto-save (every 60 seconds while connected)
- Clean up unused `Camera` import (dead camera button was already removed)

### File: `src/types/vizzy.ts` (new)
- Move `VizzyBusinessSnapshot` interface from `useVizzyContext.ts`

### File: `src/hooks/useVizzyContext.ts` (delete)
- No longer needed -- type moved, hook unused

### File: `src/lib/vizzyContext.ts`
- Update import of `VizzyBusinessSnapshot` from new types file

### Edge function deployment
- Redeploy `vizzy-context`
