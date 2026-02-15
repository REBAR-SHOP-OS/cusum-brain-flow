

## Clone Odoo 17 CRM Chatter/Timeline -- Pixel-Perfect Rebuild

### What We Have Now

The current `LeadTimeline.tsx` (531 lines) is a functional timeline but diverges from Odoo 17's chatter in several key ways:

- Composer is hidden behind a "Log Activity" button instead of always visible at top
- No "Log note" / "Send message" / "Schedule activity" tab row (Odoo's signature 3-button bar)
- Activities and messages are mixed without Odoo's visual distinction (yellow background for internal notes)
- No avatar-left layout with name + timestamp on same line
- No "Mark as done" inline button on scheduled activities
- AI suggestion panel has no Odoo equivalent and sits above the composer

### Target: Odoo 17 Chatter Layout (Top to Bottom)

```text
+--------------------------------------------------+
| [Log note]  [Send message]  [Schedule activity]  |  <-- Tab bar (always visible)
+--------------------------------------------------+
| Composer textarea (contextual to selected tab)   |
| [Attach] [Emoji]                    [Send/Log]   |
+--------------------------------------------------+
| Planned Activities Section                        |
|   Due date badge (color: red/orange/green)        |
|   Activity type icon + assigned user              |
|   [Mark Done] [Schedule Next]                     |
+--------------------------------------------------+
| Message/Note Thread (newest first)                |
|   +-- Date Separator ("February 15, 2026") ---+  |
|   | Avatar | Name        Timestamp (right)     |  |
|   |        | Message body                      |  |
|   |        | (yellow bg if internal note)      |  |
|   +--------------------------------------------+  |
+--------------------------------------------------+
| Followers bar (collapsed)                         |
+--------------------------------------------------+
```

### Implementation Plan

**Step 1: Create `OdooChatter.tsx` -- the new Odoo-clone component**

New file: `src/components/pipeline/OdooChatter.tsx`

This replaces `LeadTimeline` inside the "Timeline" tab of `LeadDetailDrawer`.

Structure:
- **Composer bar** (always visible at top)
  - 3 tab buttons: "Log note" / "Send message" / "Schedule activity"
  - Textarea appears when any tab is active
  - "Log note" tab: yellow-tinted composer, posts internal note
  - "Send message" tab: white composer (future: email send)
  - "Schedule activity" tab: shows activity type dropdown + date picker + assigned user
  - Attach button (links to existing file upload)
  - Send/Log button (right-aligned)

- **Planned Activities section**
  - Query `lead_activities` where `completed_at IS NULL` and `activity_type` in (follow_up, call, meeting, email)
  - Each shows: colored due-date badge (overdue = red, today = orange, future = green), activity type icon, assigned user, description
  - "Mark Done" button (sets `completed_at = now()`)
  - "Schedule Next" button (opens schedule form pre-filled)

- **Message Thread**
  - Merge `lead_activities` (completed) + `lead_events` + `lead_files` into unified chronological list (newest first)
  - Each entry:
    - Left: 32px avatar circle with initials
    - Right: **Name** on left, **timestamp** right-aligned on same line
    - Body below name
    - Internal notes get `bg-amber-50 dark:bg-amber-950/20` background
    - Stage changes show arrow icon with "from -> to" text
    - Files show download chip

- **Spacing and sizing (Odoo 17 parity)**
  - Avatar: 32px (w-8 h-8)
  - Font: 13px body (text-[13px]), 12px metadata
  - Message padding: 12px (p-3)
  - Gap between avatar and content: 12px (gap-3)
  - Date separator: centered text with horizontal rules
  - Composer textarea: min-height 60px
  - Tab buttons: 13px font, 8px horizontal padding, bottom-border active indicator (not pill/badge)

**Step 2: Update `LeadDetailDrawer.tsx`**

- Import `OdooChatter` instead of `LeadTimeline`
- Replace `<LeadTimeline lead={lead} />` with `<OdooChatter lead={lead} />`
- Keep `LeadTimeline.tsx` file intact (no deletion, just unused for now)

**Step 3: Odoo-specific micro-interactions**

Inside `OdooChatter.tsx`:
- Clicking "Log note" toggles composer open/closed (click again to close)
- Internal notes render with yellow/amber left border + light yellow background
- Emails show envelope icon badge
- Hover on any message row: subtle `bg-accent/50` highlight
- "Mark as Done" on activity: optimistic UI update, then DB write
- Date separators match Odoo style: "-- February 15, 2026 --"

### Files Changed

| File | Action |
|---|---|
| `src/components/pipeline/OdooChatter.tsx` | **Create** -- full Odoo 17 chatter clone |
| `src/components/pipeline/LeadDetailDrawer.tsx` | **Edit** -- swap `LeadTimeline` for `OdooChatter` in Timeline tab |

### What Stays the Same

- All data sources (`lead_activities`, `lead_events`, `lead_files`) remain unchanged
- AI suggestion panel moves to the dedicated "AI" tab (already there via `LeadAIPanel`)
- Email thread stays in its own "Email" tab
- No database changes needed
- No new dependencies

### Technical Notes

- The component reuses existing queries from `LeadTimeline.tsx` (copy the query hooks)
- Activity mutation logic (insert into `lead_activities`) is carried over
- `ScheduleActivityDialog` pattern is reused for the "Schedule activity" tab inline form
- Dark mode support maintained via Tailwind dark: variants on the yellow note backgrounds
- The 3-button tab bar uses underline active indicator (`border-b-2 border-primary`) matching Odoo's visual pattern, not Radix tabs

