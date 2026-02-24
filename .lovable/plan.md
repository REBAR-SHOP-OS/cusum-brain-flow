
## Tablet-to-Machine Assignment for Shop Floor Stations

### Problem
The `/shopfloor/station` page shows all machines and all jobs. On the shop floor, each tablet is dedicated to a specific machine, so operators should see only their assigned machine's jobs -- not the full dashboard.

### Solution: "Pin Machine to This Device" Using localStorage

Add a "pin" mechanism so a tablet can be locked to a specific machine. Once pinned:
- Visiting `/shopfloor/station` auto-redirects to `/shopfloor/station/{machineId}`
- The operator sees only their machine's jobs
- A small "unpin" button (supervisor-only or behind a long-press) allows resetting

This approach uses `localStorage` (no database changes needed) because the assignment is per-physical-device, not per-user.

### Changes

**1. New hook: `src/hooks/useTabletPin.ts`**
- Reads/writes `pinned-machine-id` from localStorage
- Exposes `pinnedMachineId`, `pinMachine(id)`, `unpinMachine()`

**2. Modified: `src/pages/StationDashboard.tsx`**
- On mount, check if a machine is pinned via `useTabletPin`
- If pinned, auto-redirect to `/shopfloor/station/{pinnedMachineId}` using `<Navigate>`
- If not pinned, show the current full dashboard (machine selector grid)

**3. Modified: `src/components/shopfloor/MachineSelector.tsx`**
- Add a "Pin to This Tablet" button (small lock icon) on each machine card
- Clicking it saves the machine ID to localStorage and navigates to the station view
- Visual confirmation via toast

**4. Modified: `src/components/shopfloor/StationHeader.tsx` or `src/pages/StationView.tsx`**
- Show a small "pinned" indicator when viewing a pinned machine
- Add an "Unpin" option in the supervisor toggle area (only visible when `isSupervisor` is true) so regular operators cannot accidentally unpin

### User Flow

```text
Tablet Setup (one-time):
  /shopfloor/station --> See all machines --> Tap "Pin" on CUTTER-01 --> Saved to localStorage

Daily Use:
  /shopfloor/station --> Auto-redirect to /shopfloor/station/[cutter-01-id] --> See only CUTTER-01 jobs

Supervisor Override:
  Toggle supervisor mode --> "Unpin Device" button appears --> Tap to reset --> Back to machine selector
```

### Technical Details

| File | Change |
|------|--------|
| `src/hooks/useTabletPin.ts` | New file: localStorage-based hook for pinned machine ID |
| `src/pages/StationDashboard.tsx` | Add auto-redirect when pinned machine exists |
| `src/components/shopfloor/MachineSelector.tsx` | Add "Pin to Tablet" button on each machine card |
| `src/pages/StationView.tsx` | Show pinned indicator; add "Unpin" button in supervisor mode |

No database migrations, no edge function changes, no schema changes required.
