

# Add Performance Metrics to Team Daily Report

## Problem
The Team Daily Report currently only shows activity count and clock entries per user. The user wants to also display performance metrics (hours worked, AI sessions, emails sent) alongside activities.

## Approach

Enhance the `useTeamDailyActivity` hook to also fetch performance data (chat sessions, communications) in the same parallel query batch, then display compact performance badges in each team member's row in the `TeamDailyReport` component.

## Changes

### 1. `src/hooks/useTeamDailyActivity.ts`

Expand `TeamMemberActivity` interface and query to include:
- **hoursToday**: calculated from clock entries (already available)
- **aiSessionsToday**: count from `chat_sessions` table per user
- **emailsSent**: count from `communications` table (outbound) per user

Add two more parallel queries:
- `chat_sessions` filtered by `user_id IN (userIds)` for the day
- `communications` filtered by `direction = 'outbound'` for the day, grouped by sender

### 2. `src/components/vizzy/VizzyBrainPanel.tsx` — `TeamDailyReport`

For each team member row (line 978-996), add compact performance badges after the activity count:
- **Hours**: clock icon + hours worked (e.g., `6.2h`)
- **AI Sessions**: brain/sparkles icon + count
- **Emails**: mail icon + count

Display as small inline badges similar to `(105 activities)` style, keeping the UI clean and compact.

| File | Change |
|------|--------|
| `useTeamDailyActivity.ts` | Add chat_sessions + communications queries; expand return type with performance metrics |
| `VizzyBrainPanel.tsx` | Show hours, AI sessions, emails as compact badges per team member |

