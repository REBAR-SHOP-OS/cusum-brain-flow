

## Change Screenshot Feedback Recipient to Radin Only

### Current Behavior
Screenshot feedback tasks and notifications are sent to **both** Sattar and Radin (two hardcoded profile IDs in `AnnotationOverlay.tsx`).

### Proposed Change
Modify `src/components/feedback/AnnotationOverlay.tsx` to send feedback tasks and notifications **only to Radin** (`RADIN_PROFILE_ID`).

### Technical Details

**File:** `src/components/feedback/AnnotationOverlay.tsx`

1. Remove `SATTAR_PROFILE_ID` constant (no longer needed)
2. Update the task creation loop to only iterate over `[RADIN_PROFILE_ID]`
3. Update the notification creation loop to only iterate over `[RADIN_PROFILE_ID]`

No other files, database tables, or UI elements will be changed.

