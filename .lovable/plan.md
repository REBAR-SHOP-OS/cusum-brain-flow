

# Fix Stale JWT Token Loop

## Problem
After Google OAuth login, a stale/corrupt JWT persists in `localStorage`. The `getSession()` call returns this stale session *without error* (it only reads from storage), so the app thinks the user is authenticated. But every API call using that token gets `403: missing sub claim`. The auto-refresh keeps polling with the bad token every ~60 seconds, creating an infinite loop.

The current guard (`if (error) { signOut... }`) never triggers because `getSession()` doesn't validate the token — it just returns whatever is in storage.

## Root Cause
`supabase.auth.getSession()` reads from `localStorage` and does **not** make a network call to validate the JWT. A corrupt token (missing `sub` claim) passes this check. Only `getUser()` actually validates against the server.

## Fix

### Modify `src/lib/auth.tsx`
After `getSession()` returns a session, add a `getUser()` validation step:

```
getSession() returns session
  → if session exists, call getUser()
    → if getUser() fails

<lov-plan>

# Fix Stale JWT Token Loop

## Problem
After Google OAuth login, a stale/corrupt JWT persists in `localStorage`. `getSession()` reads from storage without validating the token server-side, so the app thinks the user is authenticated. But every API call gets `403: missing sub claim`. The auto-refresh polls endlessly with the bad token.

## Root Cause
`supabase.auth.getSession()` does NOT validate the JWT — it just returns what's in `localStorage`. Only `getUser()` makes a server call. The current error guard never triggers because `getSession()` succeeds with the corrupt token.

## Fix

### Modify `src/lib/auth.tsx`
After `getSession()` returns a non-null session, call `getUser()` to validate. If `getUser()` fails, clear the stale session immediately:

```typescript
// Normal flow: check for existing session
supabase.auth.getSession().then(async ({ data: { session }, error }) => {
  if (error || !session) {
    if (error) {
      console.warn('Session recovery failed:', error.message);
      supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    }
    setSession(null);
    setUser(null);
    setLoading(false);
    return;
  }

  // Validate token server-side — getSession only reads localStorage
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.warn('Stale JWT detected, clearing session:', userError?.message);
    supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setSession(null);
    setUser(null);
    setLoading(false);
    return;
  }

  setSession(session);
  setUser(user);
  setLoading(false);
});
```

### Single file change
- **Modify**: `src/lib/auth.tsx` — add `getUser()` validation after `getSession()` succeeds

This stops the bad\_jwt polling loop at startup and redirects the user to the login page cleanly.

