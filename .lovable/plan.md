

# Fix: Supervisor Button Not Working in Cutter Station

## Problem
The Supervisor button in `CutterStationView.tsx` is rendered as a **static badge** (not clickable) because `isSupervisor` and `onToggleSupervisor` props are never passed to `StationHeader`. Compare with `StationView.tsx` (bender station) which correctly passes both props and has a working toggle.

In `StationHeader.tsx` logic (line 125-148):
- If `canWrite && onToggleSupervisor` → renders a **clickable Button** (toggle)
- If `canWrite` only → renders a **static Badge** saying "SUPERVISOR" (this is what's happening)

## Fix — `CutterStationView.tsx`

1. **Add local state** for supervisor mode toggle:
   ```typescript
   const [isSupervisor, setIsSupervisor] = useState(false);
   ```

2. **Pass props to both `StationHeader` instances** (lines 588 and 604):
   ```typescript
   isSupervisor={isSupervisor}
   onToggleSupervisor={() => setIsSupervisor(v => !v)}
   ```

3. **Gate the toggle** so only users with `isShopSupervisor` or `isAdmin` role can see the toggle (non-supervisors should not see the button at all). The existing `canWrite` check in StationHeader already handles this partially, but we should only pass `onToggleSupervisor` when the user actually has supervisor privileges:
   ```typescript
   onToggleSupervisor={canCorrectCount ? () => setIsSupervisor(v => !v) : undefined}
   ```
   (`canCorrectCount` is already defined as `isAdmin || isShopSupervisor` at line 46)

**One file changed:** `src/components/shopfloor/CutterStationView.tsx`

