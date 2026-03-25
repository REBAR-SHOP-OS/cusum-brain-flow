
# handleRequest Migration — COMPLETED ✅

## Summary
All eligible edge functions have been migrated to the shared `handleRequest` wrapper.

| Metric | Value |
|---|---|
| Total functions | 193 |
| Migrated | 192 (99.5%) |
| Excluded | 1 (`mcp-server` — Hono framework, incompatible) |

## Features Implemented

### `requestHandler.ts` supports:
- **`authMode`**: `"required"` (default) · `"optional"` · `"none"`
- **`parseBody`**: `true` (default) · `false` (for FormData/multipart)
- **`wrapResult`**: `true` (default, wraps in `{ ok, data }`) · `false` (pass-through)
- **`rawResponse`**: handler returns `Response` directly
- **`requireCompany`**: company resolution from profiles
- **`requireRole` / `requireAnyRole`**: role-based access control

### Auth breakdown across 192 functions:
| authMode | Count |
|---|---|
| `"required"` (default) | ~124 |
| `"none"` | 50 |
| `"optional"` | 17 |
| explicit `"required"` | 1 |

### Other patterns:
- `parseBody: false` — 10 functions (FormData endpoints)
- `wrapResult: false` — 165 functions (legacy response shape preservation)
- `rawResponse: true` — 18 functions (streaming/custom responses)

## Shared Utilities (`_shared/`)
- `auth.ts` — `requireAuth()`, `optionalAuthFull()`
- `resolveCompany.ts` — cached company_id resolution
- `requestHandler.ts` — unified wrapper
- `structuredLog.ts` — structured logging
- `roleCheck.ts` — role-based access control
- `cache.ts` — in-memory TTL cache
- `accessPolicies.ts` — super admin email list

## Minor Findings (non-blocking)
1. `website-agent/index.ts` — has leftover CORS pattern inside handler (functional, cosmetic)
2. `extract-manifest/index.ts` — uses `std@0.224.0` instead of `0.190.0` (via import_map remap, non-breaking)

## What's Next (optional improvements)
- Clean up leftover CORS boilerplate in `website-agent`
- Standardize std library version in `extract-manifest`
- Add integration tests for auth modes
- Consider consolidating `wrapResult: false` functions to use standard wrapping
