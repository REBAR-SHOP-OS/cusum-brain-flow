

# Wire Delete/Archive Actions + Show Activity Events

## Problem
1. Delete and archive actions in the EmailActionBar work but don't log any activity events -- so there's no audit trail
2. The "All Activity" tab in the customer context panel doesn't include activity_events from the database (like alert processing, deletions, archives)
3. The EmailActionBar's delete/archive don't notify the parent InboxView, so the email stays visible until page refresh

## Changes

### 1. EmailActionBar: Wire delete/archive to parent + log activity_events

**File: `src/components/inbox/EmailActionBar.tsx`**

- Add `onDelete` and `onArchive` callback props so the parent (InboxView) controls hiding/refreshing
- After the DB operation, insert an `activity_events` row:
  - entity_type: "communication"
  - entity_id: the email ID
  - event_type: "email_deleted" or "email_archived"
  - description: includes subject/sender info
  - source: "user"
  - company_id: "a0000000-0000-0000-0000-000000000001"

### 2. InboxView: Pass delete/archive handlers to EmailActionBar

**File: `src/components/inbox/InboxView.tsx`**

- Pass `handleDeleteEmail` and `handleArchiveEmail` as props to EmailActionBar (via InboxEmailViewer/InboxDetailView)
- These already do the DB delete/archive + hide from UI -- just need to also log activity_events
- Add activity_events inserts inside `handleDeleteEmail`, `handleArchiveEmail`, `handleBulkDelete`, and `handleBulkArchive`

### 3. Customer Context: Include activity_events in the All Activity tab

**File: `src/components/inbox/InboxCustomerContext.tsx`**

- Add a parallel query to `activity_events` filtered by entity_type "communication" or matching the sender email in metadata
- Map activity_events into the unified `ActivityItem[]` timeline with a new type (or reuse existing types)
- This surfaces actions like "email deleted", "email archived", "alerts processed" in the activity feed

## Technical Details

### Activity event format for inbox actions:
```typescript
await supabase.from("activity_events").insert({
  company_id: "a0000000-0000-0000-0000-000000000001",
  entity_type: "communication",
  entity_id: emailId,
  event_type: "email_deleted", // or "email_archived"
  description: `Deleted email from ${sender}: ${subject}`,
  source: "user",
  metadata: { sender, subject, action: "delete" }
});
```

### Files to modify:
1. `src/components/inbox/EmailActionBar.tsx` -- add onDelete/onArchive props, log activity
2. `src/components/inbox/InboxView.tsx` -- add activity logging to all delete/archive handlers, pass callbacks down
3. `src/components/inbox/InboxCustomerContext.tsx` -- query activity_events and merge into timeline
4. `src/components/inbox/InboxDetailView.tsx` -- pass delete/archive props through to EmailActionBar (if not already)
