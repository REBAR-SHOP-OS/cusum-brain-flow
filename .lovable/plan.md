

# Set Users Inactive on Clock-Out

## Summary
When a user clocks out (manually or auto at 5 PM), their profile should be set to `is_active = false`. Also, all current users should be set to inactive right now.

## Changes

### 1. Set all users inactive now
Run a data update via insert tool:
```sql
UPDATE profiles SET is_active = false
WHERE email LIKE '%@rebar.shop' AND lower(email) != 'kourosh@rebar.shop';
```

### 2. Frontend clock-out — set `is_active = false`
**File: `src/hooks/useTimeClock.ts`** — In the `clockOut` function, after successfully closing the shift, update the profile:
```typescript
await supabase.from("profiles").update({ is_active: false }).eq("id", myProfile.id);
```

### 3. Frontend clock-in — set `is_active = true`
**File: `src/hooks/useTimeClock.ts`** — In the `clockIn` function, after successful insert, set:
```typescript
await supabase.from("profiles").update({ is_active: true }).eq("id", myProfile.id);
```

### 4. Auto clock-out at 5 PM — set `is_active = false`
**File: `supabase/functions/auto-clockout/index.ts`** — After closing shifts, update the profiles:
```typescript
const profileIds = toClose.map((e: any) => e.profile_id);
await supabase.from("profiles").update({ is_active: false }).in("id", profileIds);
```

### 5. Kiosk punch — set `is_active` accordingly
**File: `supabase/functions/kiosk-punch/index.ts`** — After a successful clock-in punch, set `is_active = true`; after clock-out punch, set `is_active = false`.

### Files to edit
1. `src/hooks/useTimeClock.ts` — clock-in sets active, clock-out sets inactive
2. `supabase/functions/auto-clockout/index.ts` — set inactive after auto clock-out
3. `supabase/functions/kiosk-punch/index.ts` — set active/inactive on kiosk punch
4. Data update (insert tool) — set all @rebar.shop users inactive now

