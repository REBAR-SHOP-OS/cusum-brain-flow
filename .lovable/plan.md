

# Fix LinkedIn Page Names + Add Company Page Publishing

## Problem
1. LinkedIn pages list shows wrong names (Ontario Steel Detailing, Ontario Logistics) instead of correct ones (Rebar.Shop Ontario, Rebar.Shop Incorporated, Sattar Esmaeili-Oureh)
2. LinkedIn API currently only supports personal profile publishing — no company page publishing

## Changes

### 1. Update `src/lib/socialConstants.ts` — LinkedIn array
Replace current LinkedIn pages with:
```typescript
linkedin: [
  { value: "Rebar.Shop Ontario", label: "Rebar.Shop Ontario" },
  { value: "Rebar.Shop Incorporated", label: "Rebar.Shop Incorporated" },
  { value: "Sattar Esmaeili-Oureh", label: "Sattar Esmaeili-Oureh" },
],
```

### 2. Database migration — fix existing LinkedIn records
```sql
UPDATE social_posts SET page_name = 'Rebar.Shop Ontario'
WHERE platform = 'linkedin' AND page_name = 'Ontario Steel Detailing';

UPDATE social_posts SET page_name = 'Rebar.Shop Incorporated'
WHERE platform = 'linkedin' AND page_name = 'Ontario Logistics';
```

### 3. Update `supabase/functions/social-publish/index.ts` — LinkedIn publishing
Current `publishToLinkedIn` function only publishes as a personal profile (`urn:li:person`). Need to add:
- Accept `page_name` parameter
- If page_name is "Sattar Esmaeili-Oureh" → publish as personal profile (existing flow)
- If page_name is a company page → publish as `urn:li:organization:{org_id}` using LinkedIn Organizations API
- Store organization IDs in integration config during OAuth connection

**Note:** Company page publishing requires LinkedIn Organization Access tokens with `w_organization_social` scope. The OAuth flow for LinkedIn may need scope updates.

## Impact
- 1 source file: `socialConstants.ts`
- 1 edge function: `social-publish/index.ts` (add company page logic)
- 1 DB migration (rename existing records)
- LinkedIn OAuth may need reconnection with additional scopes

