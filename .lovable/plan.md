

# Fix Kiosk Status to Show All Team Members

## Problem
The Kiosk Status tab (line 496-500) only shows profiles that have at least one `source === "kiosk"` time clock entry. If nobody has punched via the kiosk, the list is empty ("No team members found").

## Fix
Change `kioskProfiles` from filtering by kiosk entries to showing **all `activeProfiles`** (same pool used by other tabs). The status indicators already handle showing "Not clocked in" / "Off" for inactive users, so no other changes needed.

### `src/pages/TimeClock.tsx` — lines 495-500

Replace the kiosk-only filter:
```typescript
const kioskProfileIds = new Set(
  allEntries
    .filter((e: any) => e.source === "kiosk")
    .map((e: any) => e.profile_id)
);
const kioskProfiles = activeProfiles.filter(p => kioskProfileIds.has(p.id));
```

With simply:
```typescript
const kioskProfiles = activeProfiles;
```

This shows all team members in the Kiosk Status tab with their current clock status, regardless of whether they've used the kiosk.

