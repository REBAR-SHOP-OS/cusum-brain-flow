

# Fix: Back Arrow Should Return to Production Card Pool

## Problem

The back arrow in the Cutter Station view navigates to `/shopfloor/station` (the machine selector page). The user wants it to go back to the **production card pool** -- the list of cards for the current machine.

The CutterStationView is rendered conditionally inside `StationView` when `selectedItemId` is set. Clearing `selectedItemId` returns to the pool without a route change.

## Changes

### 1. Add `onBack` prop to CutterStationView

Add an optional `onBack?: () => void` callback prop. Pass it through to `StationHeader` via the existing `backTo` mechanism or a new click handler.

### 2. Pass `onBack` from StationView

In `StationView.tsx`, pass `onBack={() => setSelectedItemId(null)}` to `CutterStationView` (and `BenderStationView` for consistency).

### 3. Wire up StationHeader

Add an `onBack` prop to `StationHeader`. When provided, the back arrow calls `onBack()` instead of `navigate(backTo)`.

## Technical Details

### File: `src/components/shopfloor/StationHeader.tsx`
- Add `onBack?: () => void` to props interface
- Change back button: `onClick={() => onBack ? onBack() : navigate(backTo)}`

### File: `src/components/shopfloor/CutterStationView.tsx`
- Add `onBack?: () => void` to `CutterStationViewProps`
- Pass `onBack={onBack}` to both `StationHeader` usages (lines 373 and 388)

### File: `src/components/shopfloor/BenderStationView.tsx`
- Same pattern: add `onBack` prop and pass to `StationHeader`

### File: `src/pages/StationView.tsx`
- Pass `onBack={() => setSelectedItemId(null)}` to both `CutterStationView` and `BenderStationView`

Four files, small changes each.

