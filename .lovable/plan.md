

# Fix Face ID Kiosk Errors & Add Name Registration on Failure

## Problem

The Face ID Kiosk shows "Recognition Error" + "Recognition failed" instead of allowing the user to register. Two root issues:

1. **Auth fragility**: `requireAuth` uses `getClaims()` which can fail intermittently. One of your other functions (`vizzy-erp-action`) already switched to `getUser()` with a comment noting `getClaims` is deprecated.

2. **Error = dead end**: When the edge function errors (AI timeout, auth glitch, etc.), the UI shows "Recognition Error" with only a "Try Again" button. It should fall through to the FirstTimeRegistration flow so the person can enter their name and get registered.

## Plan

### 1. Fix `requireAuth` in `supabase/functions/_shared/auth.ts`
Replace `getClaims(token)` with `getUser()` which is more reliable and not deprecated. This fixes intermittent auth failures.

```typescript
// Before (fragile):
const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

// After (reliable):
const { data: { user }, error: userError } = await userClient.auth.getUser();
if (userError || !user) throw 401;
return { userId: user.id, ... };
```

### 2. Fix Kiosk UI to show registration on error
In `src/pages/TimeClock.tsx`, change the kiosk mode rendering so both `no_match` AND `error` states show the `FirstTimeRegistration` component instead of showing a dead-end error screen.

```typescript
// Before:
{face.state === "no_match" ? (
  <FirstTimeRegistration ... />
) : (
  <FaceRecognitionResult ... />
)}

// After:
{(face.state === "no_match" || face.state === "error") ? (
  <FirstTimeRegistration ... />
) : (
  <FaceRecognitionResult ... />
)}
```

### 3. Add error-resilient fallback in edge function
In `supabase/functions/face-recognize/index.ts`, if the AI call fails entirely, return `{ matched: false, reason: "..." }` instead of a 500 error. This way the client gets `no_match` state instead of `error`.

```typescript
// In the AI error catch block, instead of returning 500:
return new Response(JSON.stringify({ matched: false, reason: "Recognition unavailable, please register manually" }), { ... });
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/_shared/auth.ts` | Replace `getClaims` with `getUser()` |
| `supabase/functions/face-recognize/index.ts` | Return `no_match` on AI failure instead of 500 |
| `src/pages/TimeClock.tsx` | Show FirstTimeRegistration for both `no_match` and `error` states in kiosk mode |

