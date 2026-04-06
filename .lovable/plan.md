

# Restrict Login to Whitelisted Emails Only

## Allowed Users (from screenshots)

| Email | Type |
|---|---|
| sattar@rebar.shop | Super Admin |
| radin@rebar.shop | Super Admin |
| zahra@rebar.shop | Internal |
| neel@rebar.shop | Internal |
| vicky@rebar.shop | Internal |
| kourosh@rebar.shop | Internal |
| saurabh@rebar.shop | Internal |
| ben@rebar.shop | Internal |
| ai@rebar.shop | Device |
| swapnil.m183@gmail.com | External |
| tariq0001010@gmail.com | External |
| ontariorebars6@gmail.com | External |

## Current State
- Signup is already invite-only (token required)
- But **login** has no email whitelist — anyone with valid credentials can sign in
- Google OAuth also has no restriction

## Changes

### 1. `src/lib/accessPolicies.ts` — Add allowed login emails list

Add a new `allowedLoginEmails` array containing all 12 emails above. This becomes the single source of truth.

### 2. `src/lib/auth.tsx` — Block sign-in for non-whitelisted emails

- In `signIn()`: check email against whitelist **before** calling Supabase. Return error "Access denied" if not on the list.
- In `onAuthStateChange`: after a session is established, check the user's email. If not whitelisted, immediately call `signOut()` and clear session. This catches Google OAuth logins from unauthorized accounts.

### 3. `src/pages/Login.tsx` — Block Google OAuth post-login

After `lovable.auth.signInWithOAuth` succeeds, if the resulting user email is not in the whitelist, sign them out and show an error toast. This handles the case where someone signs in with an unauthorized Google account.

## Impact
- Only the 12 listed users can access the system
- Email/password login blocked at the form level
- Google OAuth blocked after authentication (since we can't pre-filter Google accounts)
- No database changes needed
- Landing page unchanged (Sign In button stays, just won't work for unauthorized users)

