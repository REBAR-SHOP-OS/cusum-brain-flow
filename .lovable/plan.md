

# Penny Auto-Briefing: Engaging Page Open Experience

## Overview
When the Accounting page opens, instead of showing a static "Morning, SATTAR" greeting with quick-action buttons, Penny will automatically scan emails, QuickBooks data, and tasks, then present a prioritized daily action list to keep users accountable.

## What Changes

### 1. Replace Static Greeting with Active "Checking" Animation
Instead of the empty state with quick-action buttons, show an animated loading sequence when the page opens:
- Phase 1: "Checking your emails..." (with animated mail icon)
- Phase 2: "Reviewing QuickBooks..." (with animated dollar icon)
- Phase 3: "Building your priority list..." (with animated checklist icon)
- Each phase lasts ~1 second with smooth transitions
- This replaces the static greeting card entirely

### 2. Auto-Fire Daily Briefing Immediately
The existing `autoGreet` logic already sends a briefing request. Enhance it to:
- Include task data from the `tasks` table (open tasks assigned to this user)
- Include recent lead activity from `lead_activities` for sales-related accounting follow-ups
- Request a structured **Priority Task List** format from the AI (numbered, with urgency tags)
- The greeting prompt will explicitly ask for: overdue items first, then today's deadlines, then upcoming items

### 3. Enhanced Greeting Prompt
Update the auto-greet message to request a more actionable format:
- "Here's what needs your attention RIGHT NOW" section (red urgency)
- Numbered priority list with clear owners and deadlines
- Each item tagged with source (QuickBooks, Email, Task)
- End with "You're on track" or "X items need immediate action" summary

### 4. Quick Actions Still Available After Briefing
After the briefing loads, the quick-action buttons appear below the AI response so users can drill deeper into specific areas.

## Technical Details

### File Modified: `src/components/accounting/AccountingAgent.tsx`

1. **New "checking" animation state** -- Add a `checkingPhase` state (0-3) that cycles through phases before the AI response arrives:
   - 0: "Scanning your inbox..." with Mail icon pulse
   - 1: "Reviewing financials..." with DollarSign icon pulse  
   - 2: "Prioritizing your tasks..." with ListChecks icon pulse
   - Uses `setInterval` cycling every 1.2s while `isTyping` is true and messages are empty

2. **Enhanced auto-greet prompt** -- Update the greeting message to explicitly request:
   - Prioritized numbered action list
   - Urgency tags (URGENT / TODAY / THIS WEEK)
   - Source labels (QuickBooks, Email, Task)
   - Summary line at top ("X items need attention")

3. **Remove static empty state** -- Replace the current "Morning, USERNAME" card + 4 quick-action buttons with the animated checking sequence. Quick actions move to a row below the first AI response.

4. **Post-briefing quick actions** -- After the briefing message renders, show a compact row of follow-up buttons ("Drill into AR", "Show email details", "Create follow-up tasks") below the AI response.

### No Edge Function Changes
The existing `ai-agent` function with the "accounting" agent type already handles context-rich briefings. The enhancement is purely in the prompt quality and UI presentation.

### No Database Changes
Uses existing `tasks` and QuickBooks data already available in the component via `qbSummary` prop.

