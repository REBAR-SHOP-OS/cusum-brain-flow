

# Update: Robust Phrase Matching for `vizzy-voice`

## Problem
"how many cut plans do we have" doesn't match `text.includes("how many cut plans")` because it does — but other natural variations like "cut plan count" would fail. The current matching is too literal.

## Solution
Replace simple `includes` checks with keyword-combination matching using helper functions. Each intent is matched by checking for the presence of entity keywords plus an action keyword.

### Matching Logic

```typescript
// Helper checks
const has = (word: string) => text.includes(word);
const isCount = has("how many") || has("count") || has("total");
const isLatest = has("latest") || has("recent") || has("show");

// Intent matching (order matters — check cut plans before orders)
if (isCount && has("cut") && has("plan"))       → cut_plans count
else if (isCount && has("order"))               → orders count
else if (isCount && has("customer"))            → customers count
else if (isCount && has("lead"))                → leads count
else if (isCount && has("machine"))             → machines count
else if (isLatest && has("order"))              → latest 3 orders
else                                            → fallback help text
```

**Key fix**: "cut plans" is checked **before** "orders" so that "how many cut plans" doesn't accidentally match the orders branch (both contain "order" — wait, no they don't). Actually, the real fix is that `has("cut") && has("plan")` matches "how many cut plans do we have", "cut plan count", etc. — any phrasing containing both "cut" and "plan" plus a count keyword.

### File Changed
- `supabase/functions/vizzy-voice/index.ts` — replace if/else chain with keyword-combination matching

### Scope
- 1 file, ~15 lines changed
- No database changes
- Function will be redeployed after edit

