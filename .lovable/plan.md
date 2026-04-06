

# Remove ontariorebars6@gmail.com from System

## Current State
- Email is in the `allowedLoginEmails` whitelist in `src/lib/accessPolicies.ts` (line 51)
- No auth user or profile record exists in the database — no deletion needed there

## Change

### File: `src/lib/accessPolicies.ts`

Remove `"ontariorebars6@gmail.com"` from the `allowedLoginEmails` array (line 51).

The final list will have 11 allowed emails instead of 12.

## Impact
- This email will be blocked from both email/password and Google OAuth sign-in
- The `onAuthStateChange` guard in `auth.tsx` will auto-sign-out if somehow a session is established
- No database cleanup needed — no records exist for this email

