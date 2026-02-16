
# Security Hardening: Autopilot Engine Auth Verification

## Current State (Already Secure)

The `autopilot-engine` function is **already properly protected**:

- `requireAuth(req)` is called on **every non-OPTIONS request** (line 294)
- This validates the JWT via `getClaims()`, which verifies the token signature, expiration, and extracts the `sub` claim
- Missing or invalid tokens throw a 401 response immediately
- `verify_jwt = false` in config.toml is **intentional and correct** -- the project uses Supabase signing-keys, which are incompatible with gateway-level JWT verification. All 80+ functions in this project follow the same pattern.

**Setting `verify_jwt = true` would break the function** because the signing-keys system doesn't support gateway verification. The in-code validation via `getClaims()` is the project's standard and is documented in the Knowledge Book.

## What Needs to Be Done

Only one item: **Add a security test** to codify the 401 behavior as a regression guard.

### Test File: `supabase/functions/autopilot-engine/index.test.ts`

Three test cases:

1. **No Authorization header** -- call the function without any auth header, assert 401 response
2. **Invalid token** -- call with `Authorization: Bearer invalid-garbage-token`, assert 401 response
3. **Malformed header** -- call with `Authorization: Basic xyz`, assert 401 response

All tests use `fetch()` against the deployed function URL and consume the response body to avoid Deno resource leaks.

### Files to Create

| File | Change |
|---|---|
| `supabase/functions/autopilot-engine/index.test.ts` | New test file with 3 auth rejection test cases |

### No Changes Needed

- `config.toml` -- `verify_jwt = false` must stay (signing-keys requirement)
- `autopilot-engine/index.ts` -- already validates JWT via `requireAuth()`
- No other files affected
