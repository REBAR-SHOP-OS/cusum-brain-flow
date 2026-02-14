

# Fix: Timeclock Alerts Not Reaching Employees

## Problem Found

Looking at the database, every notification created has a dedupe key containing `:admin:` -- meaning only admin copies were created. The employee's own notification is **silently failing** because:

1. Some profiles have `user_id = NULL` (e.g., Amiri Tariq, neel@rebar.shop). Since the `notifications.user_id` column is NOT NULL, the insert throws an error and the function moves on.
2. Even when it succeeds, there's no dedup key without `:admin:` in the database -- confirming employee notifications never landed.

Additionally, the admin notification loop queries ALL active profiles across ALL companies and checks each one for admin role individually (N+1 queries), which is slow and wasteful.

## Fix

**Single file change: `supabase/functions/timeclock-alerts/index.ts`**

### 1. Skip employees with no user_id

Before inserting the employee notification, check `if (alert.userId)`. If the profile has no linked auth user, skip the employee notification (they can't log in anyway) but still notify admins.

### 2. Fix the admin query

Instead of querying ALL profiles and checking each one's role individually, query `user_roles` filtered by `role = 'admin'` and join with `profiles` filtered by `company_id = alert.companyId`. This is one query instead of N+1.

### 3. Add proper employee dedup key (without `:admin:`)

The employee notification already has the correct dedup key format (`date:profileId:alertType`). Just needs the null-guard so it doesn't fail.

## Technical Detail

```text
Changes in supabase/functions/timeclock-alerts/index.ts:

1. Guard employee notification:
   if (alert.userId) {
     await supabase.from("notifications").insert({ user_id: alert.userId, ... });
   }

2. Replace N+1 admin query loop with single query:
   const { data: adminProfiles } = await supabase
     .from("user_roles")
     .select("user_id")
     .eq("role", "admin");
   // Then filter by company using a profiles lookup
```

No database changes needed. Just the edge function logic fix.
