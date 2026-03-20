

## Fix: Google Login Redirects Back to Login Page

### Problem

Users click "Continue with Google", authenticate successfully (auth logs confirm logins), but end up back on the login/landing page. Auth logs show repeated rapid logins (5+ within 30 seconds) and `bad_jwt` / `missing sub claim` errors.

### Root Cause Analysis

The OAuth redirect flow has a **session establishment race condition**:

1. User clicks Google login → `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` redirects to Google
2. Google authenticates → redirects back to `window.location.origin` (root `/`)
3. Root `/` loads the **Landing** page, `AuthProvider` initializes
4. `AuthProvider` checks `window.location.hash` for `access_token`/`refresh_token`
5. **Problem**: If stale `sb-*` keys exist in localStorage from a previous session, `getSession()` returns a session with an expired/corrupt token. `getUser()` then sends this bad token → gets `bad_jwt` error → triggers `signOut({ scope: 'local' })` which **clears everything including the new OAuth tokens from the hash before Supabase can process them**
6. Result: session is cleared, `user = null`, Landing page shows, user sees landing/login again

Additionally, the `TOKEN_REFRESHED` handler (line 30-36) aggressively clears sessions if a refresh returns no session, which can race against the initial OAuth session establishment.

### Fix — Three Changes

**1. `src/lib/auth.tsx` — Clear stale tokens BEFORE processing OAuth callback**

In the `useEffect`, when `isOAuthCallback` is detected, clear any existing stale `sb-*` localStorage keys before letting Supabase process the hash tokens. This prevents the old corrupt tokens from interfering with the new session:

```typescript
if (isOAuthCallback) {
  // Clear stale tokens so they don't interfere with new OAuth session
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-'))
    .forEach(k => localStorage.removeItem(k));
  // ... rest of OAuth callback handling
}
```

**2. `src/lib/auth.tsx` — Guard `TOKEN_REFRESHED` handler during OAuth flow**

Prevent the `TOKEN_REFRESHED` handler from clearing the session during the initial OAuth establishment window. Add a short grace period or check that the session was actually established before allowing it to be cleared.

**3. `src/pages/Login.tsx` — Change `redirect_uri` to `/login` instead of origin root**

Change `redirect_uri: window.location.origin` to `redirect_uri: window.location.origin + '/login'` for Google and Apple OAuth. This way, after OAuth redirect, the user lands on `/login` which already has `if (user) return <Navigate to="/home" />`. This is more reliable than landing on `/` (Landing page) because:
- Login page explicitly checks auth state and redirects
- Avoids the Landing page rendering while auth is still loading

### Files
- `src/lib/auth.tsx` — clear stale tokens on OAuth callback, guard TOKEN_REFRESHED
- `src/pages/Login.tsx` — redirect to `/login` after OAuth
- `src/pages/Signup.tsx` — same redirect fix for signup Google flow

