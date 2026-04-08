

# Per-User Comprehensive PDF Report with Red Download Icon

## Goal
Transform the download icon in the "Items" header to generate a **per-user** comprehensive PDF report covering all their activities (items, time clock, agents, automations) for the selected date. Also make the icon larger and red.

## Changes

### 1. Update Edge Function `supabase/functions/generate-daily-report-pdf/index.ts`
- Accept new body params: `targetUserId`, `targetUserName`
- When `targetUserId` is provided, query **only that user's** data:
  - `activity_events` filtered by `actor_id = targetUserId`
  - `time_entries` filtered by `profile_id` (looked up from profiles via user_id)
  - `agent_sessions` filtered by user
  - Time clock entries for that user
- Update the AI prompt to generate a **per-user** report instead of company-wide:
  - User's page visits with timestamps
  - User's data mutations (leads, orders, barlists)
  - User's emails sent/received
  - User's time clock shifts (clock in/out, breaks, total hours)
  - User's agent/AI interactions
  - User's automation triggers
  - Summary and performance assessment

### 2. Update `GeneralReportPDFButton` in `VizzyBrainPanel.tsx`
- Accept `userId`, `userName`, `profileId` props
- Pass `targetUserId` and `targetUserName` to the edge function call
- Change icon styling: `w-5 h-5 text-red-500` (bigger, red)
- Update the component where it's rendered (line ~1225) to pass `selectedProfile.user_id` and `selectedProfile.full_name`

### 3. Edge Function AI Prompt
Rewrite the system prompt to focus on individual employee daily report:
- Personal activity timeline (hour by hour)
- Pages visited with time spent
- Data actions performed (created, updated, deleted)
- Communications (emails, calls)
- Time clock summary (shifts, breaks, overtime)
- AI agent usage
- Performance summary

| File | Change |
|------|--------|
| `supabase/functions/generate-daily-report-pdf/index.ts` | Accept `targetUserId`/`targetUserName`, query user-specific data, update AI prompt for per-user report |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Pass user info to `GeneralReportPDFButton`, make icon bigger + red |

