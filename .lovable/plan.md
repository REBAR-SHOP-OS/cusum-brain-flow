

# Fix Vicky's Agents & Items Not Showing in Vizzy Brain

## Root Cause
Vicky's email in the database is `anderson@rebar.shop`, but the access configuration in `userAccessConfig.ts` uses `vicky@rebar.shop`. Since `getVisibleAgents("anderson@rebar.shop")` finds no matching config entry, it returns an empty array, resulting in "No agents assigned" and no menu badges.

## Fix

### `src/lib/userAccessConfig.ts`
Change the config key from `"vicky@rebar.shop"` to `"anderson@rebar.shop"` so it matches her actual database email.

| Before | After |
|--------|-------|
| `"vicky@rebar.shop": { ... }` | `"anderson@rebar.shop": { ... }` |

One line change, single file. Everything else (agents, menus, quickActions) stays the same.

