

# Fix LinkedIn Publishing — Root Cause Audit

## Two Root Causes Found

### 1. OAuth Scopes Missing from Stored Connections
The code requests `w_organization_social` and `r_organization_social` scopes (line 198), but **both stored LinkedIn connections were authorized before these scopes were added**. The DB shows:
- `scope: "email,openid,profile,w_member_social"` — no org scopes
- `organization_ids` field is completely absent from both connections' config

**Result:** The org auto-discovery API call at line 139-157 either fails silently (403) or returns empty because the token lacks permission. So `organization_ids` is `{}`.

### 2. `page_name` is a Comma-Separated List, Not a Single Page
Posts are stored with `page_name` values like:
- `"Rebar.shop Ontario, Rebar.shop"`
- `"Ontario Steel Detailing, Ontario Logistics, Ontario Steels, Rebar.shop, Rebar.shop Ontario, Sattar Esmaeili-Oureh"`

The publish code does `orgIds[pageName]` — a direct key lookup using the entire comma-separated string. This will **never match** even when org IDs are correctly stored, because the keys in `organization_ids` are individual names like `"Rebar.shop Ontario"`.

## Fix Plan

### Step 1: Reconnect LinkedIn with Org Scopes
Use the `standard_connectors--reconnect` tool to prompt the user to reconnect LinkedIn so the new scopes (`w_organization_social`, `r_organization_social`) are granted. This triggers the OAuth callback which auto-discovers and stores `organization_ids`.

### Step 2: Fix page_name Lookup in `social-publish/index.ts`
When `pageName` contains commas, split it and find the first matching org ID:
```typescript
// Instead of: const orgId = orgIds[pageName];
// Split comma-separated page names and find first org match
const pageNames = pageName.split(",").map(s => s.trim());
let orgId: string | undefined;
let matchedPage = pageName;
for (const pn of pageNames) {
  if (orgIds[pn]) { orgId = orgIds[pn]; matchedPage = pn; break; }
}
```

### Step 3: Same fix in `social-cron-publish/index.ts`
Apply identical comma-split logic at lines 717-720.

## Files Modified
| File | Change |
|------|--------|
| `supabase/functions/social-publish/index.ts` | Split comma page_name, find first org match |
| `supabase/functions/social-cron-publish/index.ts` | Same split logic |

## User Action Required
LinkedIn must be reconnected to grant org scopes — code fix alone won't work without fresh tokens.

