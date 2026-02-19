
# Fix: `companyId is not defined` — Declare Missing Variable

## Problem

The `companyId` variable is used throughout the `ai-agent` edge function (in tool handlers like `generate_patch`, `resolve_task`, context fetching, and database queries) but is **never declared**. This causes a fatal `ReferenceError` crash whenever any of those code paths execute.

## Root Cause

At line 4834, the profile query only selects `full_name` and `email`:

```
.select("full_name, email")   // company_id NOT included
```

No `companyId` variable is ever created from this result, so every reference to it crashes.

## Changes (1 file, 3 edits)

### Edit 1: Add `company_id` to profile select and declare `companyId` (lines 4832-4837)

Replace the profile fetch block to include `company_id` and create the variable:

```javascript
const { data: userProfile } = await svcClient
  .from("profiles")
  .select("full_name, email, company_id")
  .eq("user_id", user.id)
  .maybeSingle();
const companyId = userProfile?.company_id || "a0000000-0000-0000-0000-000000000001";
const userFullName = userProfile?.full_name || user.email?.split("@")[0] || "there";
```

The fallback UUID matches the default company assigned by the `handle_new_user` trigger.

### Edit 2: Add `companyId` parameter to `fetchContext` signature (line 2874)

```javascript
async function fetchContext(supabase, agent, userId, userEmail, userRolesList, svcClient, companyId)
```

This allows company-scoped queries inside `fetchContext` to use the variable.

### Edit 3: Pass `companyId` in the `fetchContext` call (line 4877)

```javascript
const dbContext = await fetchContext(supabase, agent, user.id, userEmail, roles, svcClient, companyId);
```

## What This Fixes

- `generate_patch` will work (needs `company_id` for the `code_patches` table insert)
- `resolve_task` will work (no more crash before reaching task resolution)
- All company-scoped context fetching (accounting, orders, ventures, deliveries, etc.) will return correct data
- The Architect agent will no longer be blocked by this error
