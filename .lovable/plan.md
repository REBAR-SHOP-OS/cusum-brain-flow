

## Fix: sattar@rebar.shop Login Loop

### Root Cause

The auth flow in `src/lib/auth.tsx` has a conflict between two guards:

1. **Line 40**: `if (event === 'INITIAL_SESSION') return;` — skips INITIAL_SESSION to avoid trusting stale JWTs
2. **Line 51**: OAuth callback path relies entirely on `onAuthStateChange` to set the session

When Google OAuth redirects back to the app, Supabase processes the hash tokens and fires `INITIAL_SESSION` with the **fresh valid session**. But because line 40 unconditionally skips it, the fresh session is thrown away. Supabase may also fire `SIGNED_IN` afterward, but on the published URL there's a race condition where stale localStorage tokens trigger a failed `TOKEN_REFRESHED` before `SIGNED_IN` arrives, clearing the session entirely.

The auth logs confirm this: sattar@rebar.shop successfully authenticates via Google (200 on `/token`), but then `/user` calls fail with 403 "missing sub claim" — the app is using old corrupt localStorage tokens instead of the fresh OAuth ones.

### Fix (single file: `src/lib/auth.tsx`)

**Change 1**: Do NOT skip `INITIAL_SESSION` during OAuth callbacks. The session from hash tokens is fresh and trustworthy.

```typescript
// Line 37-40: Change from unconditional skip to conditional
if (event === 'INITIAL_SESSION' && !isOAuthCallback) return;
```

**Change 2**: Clear stale `sb-` localStorage keys at the start of an OAuth callback, before Supabase processes the hash tokens. This prevents old corrupt JWTs from interfering:

```typescript
if (isOAuthCallback) {
  // Clear stale tokens so they don't race with fresh OAuth tokens
  Object.keys(localStorage)
    .filter((k) => k.startsWith("sb-"))
    .forEach((k) => localStorage.removeItem(k));
  // ... rest of OAuth path
}
```

### Why this is safe
- Non-OAuth flow (email/password login, page refresh) still skips `INITIAL_SESSION` and validates via `getSession()` + `getUser()` — no change
- OAuth callback flow now properly receives the fresh session from the hash tokens
- Clearing stale `sb-` keys before OAuth processing eliminates the root cause of the 403 "missing sub claim" errors

### Files changed
- `src/lib/auth.tsx` — 2 small changes in the `useEffect`

