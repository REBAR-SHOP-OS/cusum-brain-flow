

## Add Optional Decline Reason with Display on Card

### Overview
When clicking "Decline", show a dialog with an optional textarea for the reason. Save it to the database and display it on declined calendar cards.

### Database
Add `decline_reason text` column (nullable) to `social_posts` via migration.

### Changes

| File | Change |
|---|---|
| Migration | `ALTER TABLE social_posts ADD COLUMN decline_reason text;` |
| `src/components/social/DeclineReasonDialog.tsx` | **New** — AlertDialog with optional Textarea + Confirm/Cancel buttons |
| `src/pages/SocialMediaManager.tsx` | Add `declineTarget` state, change `onDecline` to open dialog, update `handleDecline` to accept optional `reason` and save `decline_reason` |
| `src/components/social/SocialCalendar.tsx` | For declined posts with `decline_reason`, show truncated reason text below status line |

### Implementation Details

**DeclineReasonDialog** (new component):
- AlertDialog with title "Decline this post?"
- Optional Textarea placeholder: "Reason (optional)..."
- "Decline" button calls `onConfirm(reason)`, "Cancel" closes
- Clears textarea on close

**SocialMediaManager.tsx**:
- Add `declineTarget` state (SocialPost | null)
- `onDecline` prop opens dialog: `setDeclineTarget(selectedPost)`
- `handleDecline` updated: `updatePost.mutate({ id, status: "declined", neel_approved: false, declined_by, decline_reason: reason || null })`
- Render `<DeclineReasonDialog>` at bottom

**SocialCalendar.tsx**:
- After the status line for declined posts, add a line showing `firstPost.decline_reason` truncated with `text-[10px] text-destructive/70 truncate`

