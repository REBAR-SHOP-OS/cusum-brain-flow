

## Filter @Mention Menu to Only Show rebar.shop Team Members

### Problem
The `MentionMenu` currently queries both `profiles_safe` (team members) and `v_customers_clean` (customers), showing customers like "Intricate Build Ltd" and "MORRISON CONSTRUCTION" in the mention dropdown. Only `@rebar.shop` domain users should appear.

### Changes

**File**: `src/components/chat/MentionMenu.tsx`

1. Remove the `v_customers_clean` query entirely from `loadMentions`
2. Filter `profiles_safe` results to only include profiles with `@rebar.shop` email domain (add `.ilike("email", "%@rebar.shop")` to the query)
3. Remove `"customer"` from the `MentionItem` type — only `"team"` remains
4. Remove the `Building2` icon import and the customer icon branch in the render
5. Simplify the items mapping to only handle profiles

### Files Changed

| File | Change |
|---|---|
| `src/components/chat/MentionMenu.tsx` | Remove customer query, filter to @rebar.shop profiles only |

