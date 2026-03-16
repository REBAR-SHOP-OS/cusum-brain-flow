

# Fix: sattar@rebar.shop Login Loop

## Root Cause

Auth logs show sattar authenticating via Google OAuth **5 times in 10 minutes** — classic redirect loop. The problem:

1. User clicks "Continue with Google" on `/login`
2. Google OAuth succeeds (auth logs confirm 200 on `/token`)
3. Browser is redirected to `redirect_uri: window.location.origin + "/home"`
4. `/home` is wrapped in `ProtectedRoute` — AuthProvider hasn't processed the new session yet → `user` is `null` → redirect to `/login`
5. User is back on login page, tries again → loop

Secondary issue: `Login.tsx` never checks if the user is already authenticated, so even after a successful login, if the redirect brings them back to `/login`, they stay stuck there.

## Fix

### 1. `src/pages/Login.tsx` — Two changes

**a) Add authenticated user redirect**: If user is already logged in, redirect to `/home` (same pattern as Landing page).

```tsx
const { user, loading, signIn } = useAuth();
if (loading) return <LoadingSpinner />;
if (user) return <Navigate to="/home" replace />;
```

**b) Change OAuth redirect_uri** from `/home` to `window.location.origin` (root `/`). The Landing page at `/` properly handles auth loading state and redirects to `/home` once the session is confirmed.

```tsx
redirect_uri: window.location.origin,  // was: window.location.origin + "/home"
```

### 2. `src/pages/Signup.tsx` — Same redirect_uri fix

Change Google OAuth `redirect_uri` from `/home` to `window.location.origin`.

## Why This Works

- After OAuth, user lands on `/` (Landing page)
- Landing page shows a loading spinner while AuthProvider processes the session
- Once session is confirmed, Landing redirects to `/home`
- No race condition between ProtectedRoute and session establishment

