

## Notify All @rebar.shop Users on Official Channel Messages

### Problem
Currently, the `notify-on-message` edge function only sends notifications to users listed in `team_channel_members` for that channel. If @rebar.shop users aren't explicitly added as members, they don't get notified.

### Fix

**File**: `supabase/functions/notify-on-message/index.ts`

In `handleTeamMessage`, add a special case for the Official Channel: instead of querying `team_channel_members`, query ALL profiles with `@rebar.shop` email (excluding the sender):

```typescript
// After getting channel info (line ~59):
if (channelName === "Official Channel") {
  // Get ALL @rebar.shop profiles except sender
  const { data: profiles } = await svc
    .from("profiles")
    .select("id, user_id, preferred_language, email")
    .like("email", "%@rebar.shop")
    .neq("id", sender_profile_id);
  // Use these profiles for notification instead of channel members
} else {
  // existing channel member logic
}
```

This ensures every @rebar.shop user gets a notification (and push via the existing DB trigger) when someone posts in the Official Channel.

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/notify-on-message/index.ts` | Add Official Channel special case to notify all @rebar.shop users |

