

# Add "Transfer to Sattar" Button for Radin's Tasks

## Problem
User radin@rebar.shop needs the ability to transfer specific tasks from their column to sattar@rebar.shop. Once transferred, the task should disappear from Radin's column and appear in Sattar's.

## Approach
This is a simple reassignment — update `assigned_to` from `RADIN_PROFILE_ID` to `SATTAR_PROFILE_ID` on the task row. Only show the transfer button on Radin's task cards, and only when the current logged-in user is Radin.

## Changes

### `src/pages/Tasks.tsx`

1. **Add transfer function** (~line 508 area, near other mutations):
   - `transferToSattar(taskId)` — updates `assigned_to` to `SATTAR_PROFILE_ID`, writes audit log entry ("transferred to Sattar"), reloads data, shows toast.

2. **Add transfer button on Radin's task cards** (~line 1030 area, next to the delete button):
   - Only render when: `currentProfileId === RADIN_PROFILE_ID` AND `task.assigned_to === RADIN_PROFILE_ID` AND task is not completed.
   - Small arrow/send icon button (using `Send` from lucide) with tooltip "Transfer to Sattar".
   - On click, calls `transferToSattar(task.id)`.

No database changes needed — this just updates the existing `assigned_to` column.

## Files Modified
- `src/pages/Tasks.tsx` — add transfer function + button (Radin-only)

