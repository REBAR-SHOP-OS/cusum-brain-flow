

# Change Clock-In Restriction from 8 AM to 6 AM

Two files need the hour threshold and message updated:

1. **`src/hooks/useTimeClock.ts`** (line 118-119): Change `< 8` to `< 6`, update message to "6:00 AM"
2. **`supabase/functions/kiosk-punch/index.ts`** (line 97-98): Change `< 8` to `< 6`, update message to "6:00 AM"

No other logic or UI changes needed.

