

# Make radin@rebar.shop a Super Admin

## What Changes

Currently, super admin access is limited to `sattar@rebar.shop` via a hardcoded email check in 5 files. We need to expand this to include `radin@rebar.shop` as well.

## Files to Update

### Client-Side (3 files)

1. **`src/hooks/useSuperAdmin.ts`** -- Change single email to an array check:
   - `const SUPER_ADMIN_EMAILS = ["sattar@rebar.shop", "radin@rebar.shop"]`
   - `isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user?.email ?? "")`

2. **`src/components/office/DiagnosticLogView.tsx`** -- Same array check for diagnostic log access

### Server-Side (3 edge functions)

3. **`supabase/functions/diagnostic-logs/index.ts`** -- Expand email check to array
4. **`supabase/functions/ringcentral-sip-provision/index.ts`** -- Expand email check to array
5. **`supabase/functions/ringcentral-action/index.ts`** -- Expand email check to array

## What Radin Gets Access To

- CEO Portal (`/ceo`)
- Diagnostic Logs viewer
- Intelligence Panel toggle in user menu
- Daily Briefing on Home page
- Vizzy (CEO assistant) agent on Home
- RingCentral SIP provisioning and call actions

## Technical Detail

In every file, the pattern changes from:
```typescript
const SUPER_ADMIN_EMAIL = "sattar@rebar.shop";
// check: email === SUPER_ADMIN_EMAIL
```
to:
```typescript
const SUPER_ADMIN_EMAILS = ["sattar@rebar.shop", "radin@rebar.shop"];
// check: SUPER_ADMIN_EMAILS.includes(email)
```

All 5 files will be updated in parallel. Edge functions will be redeployed after changes.

