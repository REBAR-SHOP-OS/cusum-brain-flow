

# Show All Team Members in Kiosk Status Tab

## Problem
The "Kiosk Status" tab currently only shows users who have clocked in via kiosk today (`source === "kiosk"`). The user wants all team members (from both Team Status Office and Team Status Shop) to appear in the Kiosk Status tab.

## Change
In `src/pages/TimeClock.tsx` (lines 494-500), replace the kiosk-only filtering logic:

**Current**: Filters `allEntries` for `source === "kiosk"`, then shows only profiles matching those entries.

**New**: Use all `activeProfiles` (which already combines office + shop members). Keep the "present" count based on who is currently clocked in (regardless of source). Remove the kiosk-source filter so everyone appears — those clocked in show as "Active", others show as "Off" or their worked duration.

### Specific change
Replace lines 495-499:
```typescript
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const kioskEntries = allEntries.filter((e: any) => e.source === "kiosk" && new Date(e.clock_in) >= todayStart);
const kioskProfileIds = new Set(kioskEntries.map(e => e.profile_id));
const kioskProfiles = activeProfiles.filter(p => kioskProfileIds.has(p.id));
const presentCount = kioskProfiles.filter(p => statusMap.get(p.id)?.clocked_in).length;
```

With:
```typescript
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const todayEntries = allEntries.filter((e: any) => new Date(e.clock_in) >= todayStart);
const kioskProfiles = activeProfiles;
const presentCount = kioskProfiles.filter(p => statusMap.get(p.id)?.clocked_in).length;
```

Also update the `profileKioskEntries` filter on line 519 to use `todayEntries` instead of `kioskEntries`, and update the empty state message from "No kiosk check-ins today" to "No team members found".

