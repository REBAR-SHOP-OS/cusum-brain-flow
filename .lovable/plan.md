

# Enable LinkedIn Company Page Publishing

## Problem
LinkedIn posts are only published to the personal profile ("Sattar Esmaeili-Oureh") because:
1. The OAuth scope only requests `w_member_social` — company pages require `w_organization_social` + `r_organization_social`
2. The OAuth callback never fetches/stores LinkedIn Organization IDs
3. `socialConstants.ts` only lists the personal profile
4. The cron publisher always posts as the personal profile (ignores `page_name`)

## Changes

### 1. `supabase/functions/linkedin-oauth/index.ts` — Update OAuth scope + auto-fetch org IDs

**Scope**: Change line 171 from `"openid profile email w_member_social"` to `"openid profile email w_member_social w_organization_social r_organization_social"`

**Callback**: After token exchange, call the LinkedIn Organizations API to auto-discover admin pages:
- Fetch `GET /v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR` to find pages the user administers
- For each org, fetch `GET /v2/organizations/{id}` to get the name
- Store the result as `organization_ids: { "Rebar.Shop Ontario": "12345", "Rebar.Shop Incorporated": "67890" }` in the config

### 2. `src/lib/socialConstants.ts` — Add company pages

Add the two company pages to the LinkedIn options:
```typescript
linkedin: [
  { value: "Sattar Esmaeili-Oureh", label: "Sattar Esmaeili-Oureh (Personal)" },
  { value: "Rebar.Shop Ontario", label: "Rebar.Shop Ontario" },
  { value: "Rebar.Shop Incorporated", label: "Rebar.Shop Incorporated" },
],
```

### 3. `supabase/functions/social-cron-publish/index.ts` — Support company page publishing

The cron publisher currently ignores `page_name` for LinkedIn. Update `publishToLinkedIn` to:
- Accept `pageName` parameter
- Look up `organization_ids` from config (same logic as `social-publish`)
- Use `urn:li:organization:{orgId}` as author when publishing to a company page

### 4. User action required: Reconnect LinkedIn

After deployment, the user must reconnect LinkedIn from Settings → Integrations to grant the new `w_organization_social` scope. The callback will then auto-discover and store organization IDs.

## Summary

| File | Change |
|------|--------|
| `linkedin-oauth/index.ts` | Add org scopes + auto-fetch organization IDs on callback |
| `socialConstants.ts` | Add 2 company pages to LinkedIn options |
| `social-cron-publish/index.ts` | Support `page_name` for LinkedIn org publishing |
| `social-publish/index.ts` | Already supports org URNs — no change needed |

