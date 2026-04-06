

# Remove Public Signup Access

## Problem
The screenshot shows a public "Create account" page accessible without an invite token. Per the invite-only policy, no one should be able to reach a signup form without a valid invite link (`/signup?token=...`). Currently `/signup` is publicly routable and the Landing page links directly to it.

## Changes

### 1. `src/pages/Signup.tsx`
- The page already validates the token and shows "Invalid invite" when no token is present — this is correct
- But the page currently shows a full "Create account" form with Google sign-in and email/password when accessed without a token validation gate. Need to verify the current flow handles the no-token case properly at the top level (it does based on the code — shows invalid invite screen)

**Wait** — looking at the screenshot again, this looks like a different page or the Signup page may have been modified. The screenshot shows "Get started with REBAR SHOP OS" and a "Continue with Google" button plus "Create account with email" — this doesn't match the current `Signup.tsx` which shows "You've been invited to join REBAR SHOP OS" and requires a token.

This might be the Landing page or a modified version. Let me check if there's another signup-related page.

Actually, the current `Signup.tsx` code properly blocks access without a token. The screenshot may be showing a cached or old version OR there's another route. The key fix is:

### 1. `src/pages/Landing.tsx` — Remove all signup links
- Replace all 4 `<Link to="/signup">` with `<Link to="/login">` 
- Change button text from "Request Pilot" / "Request a Pilot" to "Sign In" or "Get Started"

### 2. `src/App.tsx` — Remove the public `/signup` route
- Remove the `/signup` route entirely OR redirect it to `/login`
- This ensures no one can navigate to `/signup` directly without being redirected

### 3. Keep invite-only flow intact
- The invite flow (`/signup?token=xyz`) should still work. Instead of removing the route, redirect `/signup` (without token) to `/login`, and keep `/signup?token=...` functional.

**Approach**: Change the `/signup` route to check for token in the route element itself — if no token param, redirect to `/login`.

## Files Changed
- `src/App.tsx` — wrap Signup route to redirect when no token
- `src/pages/Landing.tsx` — replace all `/signup` links with `/login`

