
# Add "Assign" Button to AI Actions Queue Cards

## What Changes

Each action card in the AI Actions Queue will get a new "Assign" button alongside the existing Approve, Edit & Approve, Schedule, and Reject buttons. Clicking it opens a dropdown of team members so you can assign an action item to a specific person.

## How It Works

1. A new "Assign" button appears on every pending action card
2. Clicking it shows a popover with a searchable list of team members (loaded from your profiles)
3. Selecting a person saves the assignment and shows their name on the card
4. The assigned person is stored in the database so it persists across sessions

## Technical Details

### 1. Database Migration

Add two new columns to `penny_collection_queue`:
- `assigned_to` (UUID, nullable, references profiles.id) -- who is assigned
- `assigned_at` (timestamptz, nullable) -- when it was assigned

### 2. Update Hook: `src/hooks/usePennyQueue.ts`

- Add `assigned_to` and `assigned_at` to the `PennyQueueItem` interface
- Add a new `assign(id, profileId)` callback that updates the row

### 3. Update Component: `src/components/accounting/AccountingActionQueue.tsx`

- Add a "UserPlus" icon button that opens a Popover
- Inside the popover: fetch profiles from the database and show a simple list/select
- On selection: call `assign(item.id, selectedProfileId)`
- Show the assigned person's name as a small badge on the card when set
- Pass the new `onAssign` callback through to `ActionCard`
