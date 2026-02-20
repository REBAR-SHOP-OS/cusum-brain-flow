
## Fix: Google (and Apple) OAuth Login Stuck on "Connecting..."

### Root Cause

In `src/pages/Login.tsx`, both `handleGoogleLogin` and `handleAppleLogin` have a hardcoded `redirect_uri`:

```typescript
redirect_uri: "https://cusum-brain-flow.lovable.app/home",
```

When you're on the **preview URL** (`ef512187-6c6b-411e-82cc-200307028719.lovableproject.com`), the OAuth flow completes at `oauth.lovable.app/callback` and tries to redirect back to the hardcoded published domain. The popup window can't close cleanly because the origin doesn't match the preview environment. Result: blank popup, "Connecting..." forever, login never completes.

### Fix

Replace the hardcoded URL with `window.location.origin + "/home"` in both handlers. This automatically resolves to the correct domain whether you're on the preview URL or the published site.

**Current (broken):**
```typescript
redirect_uri: "https://cusum-brain-flow.lovable.app/home",
```

**Fixed:**
```typescript
redirect_uri: `${window.location.origin}/home`,
```

### Files to Change

| File | Change |
|---|---|
| `src/pages/Login.tsx` | Replace hardcoded `redirect_uri` in `handleGoogleLogin` (line ~48) and `handleAppleLogin` (line ~62) with `window.location.origin + "/home"` |

That's the entire fix — two character substitutions in one file. No backend changes needed.

### Why This Works

- On preview: `window.location.origin` = `https://ef512187-6c6b-411e-82cc-200307028719.lovableproject.com` → OAuth redirects back correctly
- On published site: `window.location.origin` = `https://cusum-brain-flow.lovable.app` → same behavior as before
- The `/home` suffix is preserved so users land on the right page after login
