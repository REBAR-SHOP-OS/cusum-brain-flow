

# Fix: Delete Emails from Gmail (Not Just Database)

## Problem
Currently, deleting an email only removes it from the local `communications` table. The next time Gmail syncs, it re-imports the same email because it still exists in Gmail. The email needs to be trashed in Gmail as well.

## Solution
Create a new edge function `gmail-delete` that calls the Gmail API to trash a message, then update the frontend delete handler to call it before removing from the database.

## Technical Changes

### 1. New Edge Function: `supabase/functions/gmail-delete/index.ts`
- Authenticates the user (same pattern as `gmail-sync`)
- Gets the user's Gmail access token via `getAccessTokenForUser` (reuse from `gmail-sync` or shared helper)
- Accepts `{ messageId: string }` in the request body (the Gmail `source_id`)
- Calls `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/{messageId}/trash` to move it to Gmail's trash
- Returns success/failure

### 2. Update `src/components/inbox/InboxView.tsx`
- In `handleDeleteEmail`: before deleting from the `communications` table, check if the email has a `sourceId` (Gmail message ID). If so, call the `gmail-delete` edge function to trash it in Gmail first.
- Same for `handleBulkDelete`: loop through selected emails and call `gmail-delete` for each one that has a `sourceId`.
- If the Gmail delete call fails (e.g., user not connected), still proceed with local database deletion but show a warning that it may reappear on next sync.

### 3. Flow After Fix

```text
User clicks Delete
    |
    v
Has sourceId? --Yes--> Call gmail-delete edge function (trash in Gmail)
    |                        |
    No                   Success/Fail
    |                        |
    v                        v
Delete from communications table
    |
    v
Call refresh() to update UI
```

This ensures deleted emails are removed from both Gmail and the database, so they won't reappear on the next sync.
