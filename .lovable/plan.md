
# Rebar Shop OS — Project Plan

## Architecture Reference
Full system architecture documented in [`docs/REBAR_SHOP_OS_Architecture.md`](../docs/REBAR_SHOP_OS_Architecture.md).

---

## handleRequest Migration — COMPLETED ✅

| Metric | Value |
|---|---|
| Total functions | 193 |
| Migrated | 192 (99.5%) |
| Excluded | 1 (`mcp-server` — Hono framework, incompatible) |

### Auth breakdown across 192 functions:
| authMode | Count |
|---|---|
| `"required"` (default) | ~124 |
| `"none"` | 50 |
| `"optional"` | 17 |

### Other patterns:
- `parseBody: false` — 10 functions (FormData endpoints)
- `wrapResult: false` — 165 functions (legacy response shape preservation)
- `rawResponse: true` — 18 functions (streaming/custom responses)

---

## Next Steps (optional)
- [ ] Clean up leftover CORS boilerplate in `website-agent`
- [ ] Standardize std library version in `extract-manifest`
- [ ] Add integration tests for auth modes
- [ ] Migrate email-based `AdminRoute` to role-based checks
- [ ] Consider consolidating `wrapResult: false` functions to standard wrapping
