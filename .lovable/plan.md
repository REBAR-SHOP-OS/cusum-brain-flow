

# Change Kiosk Sleep Timer from 5 Minutes to 3 Minutes

## Change

### File: `src/pages/TimeClock.tsx` (line 65)

Change `KIOSK_IDLE_MS` from `5 * 60 * 1000` to `3 * 60 * 1000`.

```typescript
const KIOSK_IDLE_MS = 3 * 60 * 1000; // 3 minutes
```

## Impact
- Only affects kiosk sleep timeout for all kiosk users (including ai@rebar.shop)
- No other logic or behavior changes

