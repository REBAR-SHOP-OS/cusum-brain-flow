
# Fix "Failed to Open DM" + Agent "I couldn't process that request"

## Root Cause Analysis

There are TWO interconnected problems:

### Problem 1: "Failed to Open DM" (the actual bug)
The `useOpenDM` hook does:
1. INSERT into `team_channels` (with `.select("id").single()`)
2. INSERT into `team_channel_members` (add both users)

But the SELECT RLS policy on `team_channels` requires `is_channel_member(auth.uid(), id)` -- meaning the user must already be a member to read the row. At step 1, no members exist yet, so the `.select("id").single()` after INSERT fails because RLS blocks reading back the just-inserted row.

### Problem 2: Agent says "I couldn't process that request"
The Architect agent correctly identifies it as an RLS issue and tries to use `db_read_query`, but the Gemini model is likely hitting a context/processing error in the multi-turn loop. This is secondary -- fixing the actual DM bug eliminates the need for the agent to fix it.

## Solution

### 1. Create a server-side `create_dm_channel` RPC function (SQL Migration)
An atomic SECURITY DEFINER function that:
- Checks both users belong to the same company
- Checks for existing DM between the two users
- Creates the channel + members in one transaction
- Returns the channel ID
- Bypasses RLS timing issues entirely

### 2. Update `useOpenDM` hook to use the RPC
Replace the multi-step client-side logic with a single `supabase.rpc('create_dm_channel', ...)` call.

### 3. Fix the SELECT RLS policy on `team_channels`
Add `OR (created_by = auth.uid())` to the SELECT policy so channel creators can always read their own channels. This prevents similar issues in other flows.

## Files Modified

| File | Change |
|------|--------|
| SQL Migration | Create `create_dm_channel` RPC function |
| SQL Migration | Update SELECT policy on `team_channels` |
| `src/hooks/useChannelManagement.ts` | Simplify `useOpenDM` to use RPC |

## Technical Details

### `create_dm_channel` RPC
```sql
CREATE OR REPLACE FUNCTION public.create_dm_channel(
  _my_profile_id uuid,
  _target_profile_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _my_company uuid;
  _target_company uuid;
  _existing_channel uuid;
  _new_channel uuid;
  _dm_name text;
  _my_name text;
  _target_name text;
BEGIN
  -- Verify caller owns _my_profile_id
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _my_profile_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Profile mismatch';
  END IF;

  -- Get companies
  SELECT company_id, full_name INTO _my_company, _my_name FROM profiles WHERE id = _my_profile_id;
  SELECT company_id, full_name INTO _target_company, _target_name FROM profiles WHERE id = _target_profile_id;

  IF _my_company IS DISTINCT FROM _target_company THEN
    RAISE EXCEPTION 'Users must be in the same company';
  END IF;

  -- Check existing DM
  SELECT tc.id INTO _existing_channel
  FROM team_channels tc
  JOIN team_channel_members m1 ON m1.channel_id = tc.id AND m1.profile_id = _my_profile_id
  JOIN team_channel_members m2 ON m2.channel_id = tc.id AND m2.profile_id = _target_profile_id
  WHERE tc.channel_type = 'dm'
  LIMIT 1;

  IF _existing_channel IS NOT NULL THEN
    RETURN _existing_channel;
  END IF;

  -- Create channel + members atomically
  _dm_name := (SELECT string_agg(n, ' & ' ORDER BY n) FROM unnest(ARRAY[_my_name, _target_name]) AS n);

  INSERT INTO team_channels (name, channel_type, created_by, company_id)
  VALUES (_dm_name, 'dm', auth.uid(), _my_company)
  RETURNING id INTO _new_channel;

  INSERT INTO team_channel_members (channel_id, profile_id) VALUES
    (_new_channel, _my_profile_id),
    (_new_channel, _target_profile_id);

  RETURN _new_channel;
END;
$$;
```

### Updated SELECT Policy
```sql
DROP POLICY "Users can view channels they belong to" ON team_channels;
CREATE POLICY "Users can view channels they belong to or created"
  ON team_channels FOR SELECT
  USING (is_channel_member(auth.uid(), id) OR created_by = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin'::app_role]));
```

### Simplified `useOpenDM` Hook
The entire mutation reduces to:
```typescript
const { data, error } = await supabase.rpc('create_dm_channel', {
  _my_profile_id: myProfile.id,
  _target_profile_id: targetProfileId,
});
if (error) throw error;
return { id: data, existed: false };
```
