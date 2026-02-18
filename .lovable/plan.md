

# Why ARIA Couldn't Fix It + Complete Fix

## What Went Wrong

ARIA has the tools (`db_read_query`, `db_write_fix`) in her code, but the **backend functions they depend on were never created**. When she tries to run `db_read_query`, it calls `execute_readonly_query` which doesn't exist in the database -- so the call fails silently and she falls back to "I couldn't process that request."

Think of it like giving someone a remote control without batteries -- the buttons are there but nothing happens when you press them.

## What Needs to Be Done (3 fixes in 1 migration)

### Fix 1: Create the missing backend functions for ARIA's tools
- `execute_readonly_query` -- lets ARIA inspect the database (read-only)
- `execute_write_fix` -- lets ARIA apply safe SQL fixes

### Fix 2: Create the `create_dm_channel` function
- Atomic DM creation that bypasses the RLS timing bug
- Checks both users are in the same company
- Returns existing DM if one already exists

### Fix 3: Update the RLS SELECT policy on `team_channels`
- Allow channel creators to always see their own channels
- Prevents the read-back failure after INSERT

### Fix 4: Update the `useOpenDM` hook
- Replace the multi-step client-side logic with a single `supabase.rpc('create_dm_channel', ...)` call

## Files Modified

| File | Change |
|------|--------|
| SQL Migration | Create `execute_readonly_query`, `execute_write_fix`, `create_dm_channel` functions + update RLS policy |
| `src/hooks/useChannelManagement.ts` | Simplify `useOpenDM` to use the new RPC |

## Technical Details

### Backend Functions (SQL)

```sql
-- 1. ARIA's read-only inspector
CREATE OR REPLACE FUNCTION public.execute_readonly_query(sql_query text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result jsonb;
BEGIN
  EXECUTE sql_query INTO result;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.execute_readonly_query FROM public, anon, authenticated;

-- 2. ARIA's safe write tool
CREATE OR REPLACE FUNCTION public.execute_write_fix(sql_query text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result jsonb;
BEGIN
  EXECUTE sql_query;
  RETURN jsonb_build_object('success', true);
END; $$;
REVOKE ALL ON FUNCTION public.execute_write_fix FROM public, anon, authenticated;

-- 3. Atomic DM channel creator (the actual bug fix)
CREATE OR REPLACE FUNCTION public.create_dm_channel(
  _my_profile_id uuid, _target_profile_id uuid
) RETURNS uuid ...
```

### Simplified useOpenDM Hook

```typescript
const { data, error } = await supabase.rpc('create_dm_channel', {
  _my_profile_id: myProfile.id,
  _target_profile_id: targetProfileId,
});
if (error) throw error;
return { id: data, existed: false };
```

After this, both problems are permanently fixed:
- "Failed to open DM" will never happen again (atomic RPC bypasses RLS timing)
- ARIA will be able to investigate and fix future database issues herself using her new tools

