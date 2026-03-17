

# Shop Floor & Production Improvements Plan

Based on the audit findings and codebase analysis, here are the high-impact changes for the Shop Floor & Production modules.

---

## 1. Machine Type & Status Filters on Station Dashboard

**Problem:** The Station Dashboard (`StationDashboard.tsx`) shows all machines and production data without filtering. During peak hours it becomes cluttered.

**Solution:** Add a filter toolbar above the content area with:
- **Machine type filter**: Dropdown to filter by `cutter`, `bender`, or `all`
- **Status filter**: Toggle chips for `running`, `idle`, `blocked`, `down`
- Pass filters down to `MachineSelector`, `ActiveProductionHub`, and `WorkOrderQueueSection`

**Files:** `src/pages/StationDashboard.tsx`

---

## 2. Machine Downtime Alerts

**Problem:** No proactive alerts when a machine goes down or stays idle too long. The CEO dashboard tracks this but the shop floor doesn't.

**Solution:** Add a `DowntimeAlertBanner` component that:
- Queries `machines` for any with `status = 'down'`
- Shows a persistent red alert banner at the top of `StationDashboard` with machine name + how long it's been down
- Also flag machines idle for >30 minutes with a yellow warning
- Uses the existing realtime subscription to stay current

**Files:** New `src/components/shopfloor/DowntimeAlertBanner.tsx`, integrate into `StationDashboard.tsx`

---

## 3. QR Code Scan-to-Start for Production Jobs

**Problem:** Operators manually browse and select jobs. The audit recommends barcode/QR scanning to start/complete jobs.

**Solution:** The project already has `html5-qrcode` installed and `QRCameraScanner.tsx` in the camera module. Reuse this:
- Add a "Scan QR" button to `StationHeader.tsx` (next to the supervisor toggle)
- When scanned, parse the QR payload (format: `{cutPlanItemId}` or `{orderId}:{markNumber}`)
- Auto-navigate to the correct station view and pre-select the matching item
- Works on tablets that operators already use

**Files:** `src/components/shopfloor/StationHeader.tsx`, new `src/components/shopfloor/QRJobScanner.tsx`

---

## 4. Station Instructions & Drawing Preview

**Problem:** Operators must mentally map shape codes to bending instructions. The audit recommends displaying instructions/drawings at each station.

**Solution:** Expand the `ProductionCard.tsx` to show:
- A collapsible "Instructions" section that displays `notes` from the cut plan item
- An inline drawing reference thumbnail (already have `drawing_ref` field) that opens the full annotated drawing in a dialog
- The `AsaShapeDiagram` is already rendered; enhance it with dimension labels from the item's `dimensions` JSON

**Files:** `src/components/shopfloor/ProductionCard.tsx`

---

## 5. Shift-Based Filtering for Live Monitor

**Problem:** No way to filter production data by shift (day/night).

**Solution:** Add shift awareness:
- Define shift boundaries (e.g., Day: 6AM-6PM, Night: 6PM-6AM) as constants
- Add a shift toggle to `StationDashboard.tsx` header
- Filter `machine_runs` and work orders by `started_at` timestamp within the selected shift window
- Default to "current shift" based on system time

**Files:** `src/pages/StationDashboard.tsx`, new helper `src/lib/shiftUtils.ts`

---

## Summary

| # | Feature | Impact | Complexity |
|---|---------|--------|------------|
| 1 | Machine type/status filters | High — reduces clutter | Low |
| 2 | Downtime alert banners | High — immediate visibility | Low |
| 3 | QR scan-to-start | High — reduces errors | Medium |
| 4 | Inline instructions/drawings | Medium — operator guidance | Low |
| 5 | Shift-based filtering | Medium — cleaner views | Medium |

All changes are frontend-only (no new DB tables or edge functions needed). The QR scanner reuses the existing `html5-qrcode` dependency and `QRCameraScanner` pattern.

