

# Upgrade Inbox to Modern AI-Driven Email Experience

## Overview
Enhance the existing Inbox with features found in modern AI-powered email clients like Superhuman, Spark, and Shortwave. The inbox already has a strong foundation (unified communications, Kanban view, AI labeling, smart reply, customer context). This plan adds the missing polish and AI-powered features.

## New Features

### 1. AI Quick Reply Chips
When viewing an email, show 3 AI-generated one-liner reply suggestions (e.g., "Thanks, got it!", "Let me check and get back to you", "Sounds good, let's proceed"). Clicking a chip opens the reply composer pre-filled.

- **Where**: `InboxDetailView.tsx` -- below the thread, above the action bar
- **Backend**: New action in `draft-email` edge function that generates 3 short responses using tool calling for structured output
- **Model**: `google/gemini-2.5-flash-lite` (fast, cheap)

### 2. AI Tone Adjuster for Drafts
In the reply composer, add tone buttons: **Formal**, **Casual**, **Shorter**, **Longer**. Clicking one rewrites the current draft text in that tone via AI.

- **Where**: `EmailReplyComposer.tsx` -- new row of tone chips below the textarea
- **Backend**: New action in `draft-email` edge function (`action: "adjust-tone"`)

### 3. AI Per-Email Summary
A "Summarize" button on the email detail view that generates a 2-3 bullet point summary of a long email/thread, shown as a collapsible banner.

- **Where**: `InboxDetailView.tsx` -- button in header, summary banner below subject
- **Backend**: New action in `draft-email` edge function (`action: "summarize-email"`)

### 4. Snooze with Time Picker
Replace the toast-only snooze with a functional snooze popover offering preset times (1 hour, 3 hours, Tomorrow AM, Next Week). Snoozed emails are hidden and re-surface at the chosen time.

- **Where**: `EmailActionBar.tsx` dropdown + `InboxView.tsx` state management
- **Storage**: Local state with `snoozedUntil` map (no DB needed -- client-side hide/show)

### 5. Star/Pin Emails
Toggle star on emails. Starred emails get a visual indicator and can be filtered.

- **Where**: `InboxEmailList.tsx` (star icon), `InboxView.tsx` (new "Starred" filter chip)
- **Storage**: Local state set of starred IDs

### 6. Follow-up Reminder Nudges
In the AI summary panel, highlight emails older than 48 hours with no reply and label them "Needs Follow-up". Add a filter chip for quick access.

- **Where**: `InboxView.tsx` categorization logic + new filter chip
- **Logic**: Compare `receivedAt` with current time, check if outbound reply exists in thread

### 7. Email Templates (Quick Responses)
A template drawer accessible from the reply composer. Users can save drafts as templates and insert them with one click.

- **Where**: New `EmailTemplatesDrawer.tsx` component, button in `EmailReplyComposer.tsx`
- **Storage**: `localStorage` for MVP (no DB migration needed)

### 8. Keyboard Shortcuts
Add hotkeys for power users: `j/k` navigate list, `e` archive, `#` delete, `r` reply, `a` reply all, `f` forward, `s` star, `/` search.

- **Where**: `InboxView.tsx` -- `useEffect` with `keydown` listener
- **Scope**: Only active when inbox tab is focused

### 9. Undo Send (5-second delay)
After clicking Send, show a toast with "Undo" button. The actual Gmail send is delayed by 5 seconds, giving the user a chance to cancel.

- **Where**: `EmailReplyComposer.tsx` -- wrap send in a `setTimeout` with toast

### 10. Mark as Read/Unread (functional)
Wire up the existing "Mark as unread" dropdown item to actually toggle the `status` field in the `communications` table.

- **Where**: `EmailActionBar.tsx` + DB update via supabase client

## Files to Create
- `src/components/inbox/QuickReplyChips.tsx` -- AI suggestion chips
- `src/components/inbox/EmailTemplatesDrawer.tsx` -- template save/load UI
- `src/components/inbox/EmailSummaryBanner.tsx` -- per-email AI summary display
- `src/components/inbox/SnoozePopover.tsx` -- time picker for snooze

## Files to Modify
- `src/components/inbox/InboxDetailView.tsx` -- add quick reply chips, summarize button, summary banner
- `src/components/inbox/EmailReplyComposer.tsx` -- tone adjuster, templates button, undo send
- `src/components/inbox/EmailActionBar.tsx` -- snooze popover, functional mark read/unread, star toggle
- `src/components/inbox/InboxView.tsx` -- keyboard shortcuts, starred filter, follow-up nudges, snooze state
- `src/components/inbox/InboxEmailList.tsx` -- star icon display
- `src/components/inbox/InboxKanbanBoard.tsx` -- star icon on cards
- `supabase/functions/draft-email/index.ts` -- add `summarize-email`, `quick-replies`, `adjust-tone` actions

## Technical Notes

### Edge Function Changes (`draft-email`)
The existing function handles single draft generation. It will be extended with an `action` field in the request body:
- `action: "draft"` (default, existing behavior)
- `action: "quick-replies"` -- returns 3 short reply suggestions via tool calling
- `action: "summarize-email"` -- returns 2-3 bullet summary
- `action: "adjust-tone"` -- rewrites draft text with specified tone

### No Database Migrations
All new features use client-side state (`localStorage` for templates, component state for snooze/star). The only DB write is toggling `communications.status` for mark read/unread, which uses existing RLS policies.

### Mobile Responsiveness
- Quick reply chips: horizontal scroll on mobile
- Tone adjuster: wrap to second line on small screens
- Snooze popover: bottom-aligned on mobile
- Keyboard shortcuts: desktop only (hidden on touch devices)

