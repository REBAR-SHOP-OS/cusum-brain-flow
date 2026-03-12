

# Exempt Saurabh & Vicky from Clock-in Time Restriction

## Problem
Saurabh Seghal (`saurabh@rebar.shop`) and Vicky Anderson (`anderson@rebar.shop`) are shop/sales workers who are hitting the 6 AM clock-in restriction meant for office staff. They need to be exempt, like Kourosh Zand already is.

## Changes

### 1. `src/hooks/useTimeClock.ts`
Update the `isRebarUser` check to also exclude `saurabh@rebar.shop` and `anderson@rebar.shop`:
```typescript
const CLOCK_EXEMPT = ["kourosh@rebar.shop", "saurabh@rebar.shop", "anderson@rebar.shop"];
const isRebarUser = email.endsWith("@rebar.shop") && !CLOCK_EXEMPT.includes(email);
```

### 2. `supabase/functions/kiosk-punch/index.ts`
Same exemption list applied server-side so kiosk clock-in also works for these users.

