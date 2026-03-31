

# Remove Unconnected LinkedIn Pages from Selection

## Problem
"Rebar.Shop Ontario" and "Rebar.Shop Incorporated" are listed as LinkedIn page options but are not actually connected (no OAuth tokens or organization IDs exist). Only "Sattar Esmaeili-Oureh" (personal profile) is authenticated.

## Change

### `src/lib/socialConstants.ts` — Remove unconnected LinkedIn entries
Replace the LinkedIn array with only the connected account:
```typescript
linkedin: [
  { value: "Sattar Esmaeili-Oureh", label: "Sattar Esmaeili-Oureh" },
],
```

This removes "Rebar.Shop Ontario" and "Rebar.Shop Incorporated" from the LinkedIn dropdown until they are properly connected with `w_organization_social` scope and valid organization IDs.

## Impact
- 1 file changed: `src/lib/socialConstants.ts`
- No database migration needed (existing posts keep their page_name, they just won't appear as options for new posts)

