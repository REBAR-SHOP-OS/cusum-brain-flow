
# Fix: OAuth Redirect After Test/Live Environment Switch

## Problem Found
The **Signup page** (`src/pages/Signup.tsx`, line 48) has a **hardcoded redirect URL**:
```
redirect_uri: "https://cusum-brain-flow.lovable.app/home"
```

Meanwhile, the **Login page** correctly uses a dynamic origin:
```
redirect_uri: `${window.location.origin}/home`
```

After enabling Test/Live environments, the **preview URL changed** to:
```
https://id-preview--ef512187-6c6b-411e-82cc-200307028719.lovable.app
```

When Sattar tries to sign up or use Google OAuth from the preview, the hardcoded URL sends him to the published (Live) domain instead of back to the current environment. Combined with stale JWT tokens in his browser from before the environment switch, this creates a login loop.

## Fix (2 changes in 1 file)

### 1. `src/pages/Signup.tsx` -- Fix hardcoded redirect URL
Change line 48 from:
```
redirect_uri: "https://cusum-brain-flow.lovable.app/home"
```
to:
```
redirect_uri: `${window.location.origin}/home`
```
This matches the Login page pattern and works correctly in both preview and published environments.

### 2. `src/pages/Login.tsx` -- Add session recovery link
Add a "Having trouble signing in? Clear session" link below the sign-up text. When clicked, it removes all stale `sb-*` keys from `localStorage` and reloads the page, so users with corrupt tokens from the environment switch can self-recover without opening dev tools.

## Why This Fixes It
- The hardcoded URL fix ensures OAuth redirects go to the correct environment
- The session recovery link lets Sattar (and any future user) clear stale tokens with one click
- No backend changes needed -- this is purely a frontend fix
