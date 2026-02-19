
# Phase 15: Notification Center, Advanced AI Scoring, Communication Tracking, and Mobile UX

## Overview
This phase adds four major capability tracks plus bonus improvements: a full notification center with preferences, ML-enhanced lead scoring, a lead communication timeline, mobile-friendly pipeline interactions, and additional polish.

---

## Track 1: Notification Center Enhancement

### Current State
- `notifications` table exists with user_id, type, title, description, status, priority, link_to, metadata
- `useNotifications` hook handles realtime, read/unread, dismiss
- `InboxPanel` is a slide-out panel from TopBar with tabs (Notifications, To-do, Ideas)
- No notification preferences exist

### Changes

**Database Migration:**
- Create `notification_preferences` table:
  - `id`, `user_id` (uuid, unique), `company_id` (uuid)
  - `email_enabled` (boolean, default true)
  - `push_enabled` (boolean, default true)
  - `sound_enabled` (boolean, default true)
  - `quiet_hours_start` (time, nullable), `quiet_hours_end` (time, nullable)
  - `muted_categories` (text[], default '{}') -- e.g. ['pipeline', 'hr', 'system']
  - RLS: users can only read/write their own row

**New Components:**
- `src/components/notifications/NotificationPreferences.tsx` -- Settings dialog for notification preferences (email, push, sound, quiet hours, category muting)
- `src/components/notifications/NotificationFilters.tsx` -- Filter bar for InboxPanel (by priority, agent, date range)

**Modified Files:**
- `src/components/panels/InboxPanel.tsx` -- Add settings gear icon, filter bar, group-by-date headers, search input
- `src/hooks/useNotifications.ts` -- Integrate preference checks (mute sound during quiet hours, filter muted categories)

---

## Track 2: Advanced AI Lead Scoring

### Current State
- `lead_scoring_rules` table with rule-based scoring (field/operator/value/points)
- `computed_score`, `win_prob_score`, `priority_score`, `score_confidence` columns on leads
- `score_lead` database function exists
- `LeadScoringEngine.tsx` provides a rules UI

### Changes

**Database Migration:**
- Create `lead_score_history` table:
  - `id`, `lead_id` (uuid, FK leads), `company_id` (uuid)
  - `score` (integer), `win_probability` (numeric), `priority_score` (numeric)
  - `score_factors` (jsonb) -- breakdown of what contributed to the score
  - `model_version` (text, default 'v1')
  - `created_at` (timestamptz)
  - Index on (lead_id, created_at DESC)
  - RLS: company-scoped read

**New Components:**
- `src/components/pipeline/LeadScoreBreakdown.tsx` -- Popover/tooltip showing score factor breakdown on LeadCard (hover over win probability badge)
- `src/components/pipeline/intelligence/LeadScoringInsights.tsx` -- New "Scoring" section in AI Coach tab showing score distribution, top movers, and risk alerts

**Modified Files:**
- `src/components/pipeline/LeadCard.tsx` -- Add score breakdown popover on win probability badge click
- `src/components/pipeline/intelligence/AICoachingDashboard.tsx` -- Integrate scoring insights section
- `src/hooks/useLeadScoring.ts` -- Add history tracking on score recalculation, score trend analysis

---

## Track 3: Communication & Activity Timeline

### Current State
- `activity_events` table captures various entity events
- No dedicated lead communication timeline on lead cards/detail

### Changes

**Database Migration:**
- Create `lead_communications` table:
  - `id`, `lead_id` (uuid, FK leads), `company_id` (uuid)
  - `comm_type` (text) -- 'email', 'call', 'meeting', 'note', 'sms'
  - `direction` (text) -- 'inbound', 'outbound'
  - `subject` (text, nullable), `body_preview` (text, nullable)
  - `contact_name` (text, nullable), `contact_email` (text, nullable)
  - `metadata` (jsonb), `created_at` (timestamptz)
  - Validation trigger for comm_type and direction
  - Index on (lead_id, created_at DESC)
  - RLS: company-scoped

**New Components:**
- `src/components/pipeline/LeadActivityTimeline.tsx` -- Vertical timeline showing all communications/activities for a lead, with icons per type, timestamps, and previews
- `src/components/pipeline/AddCommunicationDialog.tsx` -- Dialog to manually log a call, meeting, note, or email for a lead

**Modified Files:**
- `src/components/pipeline/LeadDetailPanel.tsx` (or equivalent detail view) -- Add activity timeline tab
- `src/pages/Pipeline.tsx` -- Wire up communication logging from lead detail

---

## Track 4: Mobile UX Improvements

### Current State
- Pipeline uses horizontal scroll board with drag-and-drop
- No touch/swipe optimizations
- Mobile bottom nav exists (`MobileNavV2`)

### Changes

**New Components:**
- `src/components/pipeline/MobilePipelineView.tsx` -- Stacked card list view for mobile (replaces board on small screens) with:
  - Stage selector dropdown at top
  - Swipe-to-move gesture on cards (swipe right = advance stage, swipe left = move back)
  - Pull-to-refresh
  - Quick action buttons (call, email, note) on card swipe reveal
- `src/components/pipeline/SwipeableLeadCard.tsx` -- Touch-optimized lead card with swipe actions using framer-motion gestures

**Modified Files:**
- `src/pages/Pipeline.tsx` -- Detect mobile viewport, render MobilePipelineView instead of PipelineBoard
- `src/components/pipeline/LeadCard.tsx` -- Add touch-friendly tap targets (minimum 44px)

---

## Track 5: Bonus Enhancements

### 5a. Notification Sound Preferences
- Respect `sound_enabled` and `quiet_hours` from preferences in `useNotifications`

### 5b. Lead Card Quick Actions
- Add quick-action icons on card hover (desktop) or long-press (mobile): Call, Email, Note, Move Stage

### 5c. Pipeline Keyboard Shortcut Help
- `src/components/pipeline/KeyboardShortcutHelp.tsx` -- `?` key opens a modal showing all available shortcuts

### 5d. Stale Lead Auto-Flagging
- Visual indicator on LeadCard when a lead hasn't been updated in 7+ days (amber border glow)

---

## Technical Details

### Database Migrations (3 total)
1. `notification_preferences` table with RLS
2. `lead_score_history` table with RLS and indexes
3. `lead_communications` table with validation trigger and RLS

### New Files (8)
- `src/components/notifications/NotificationPreferences.tsx`
- `src/components/notifications/NotificationFilters.tsx`
- `src/components/pipeline/LeadScoreBreakdown.tsx`
- `src/components/pipeline/intelligence/LeadScoringInsights.tsx`
- `src/components/pipeline/LeadActivityTimeline.tsx`
- `src/components/pipeline/AddCommunicationDialog.tsx`
- `src/components/pipeline/MobilePipelineView.tsx`
- `src/components/pipeline/SwipeableLeadCard.tsx`
- `src/components/pipeline/KeyboardShortcutHelp.tsx`

### Modified Files (7-8)
- `src/components/panels/InboxPanel.tsx`
- `src/hooks/useNotifications.ts`
- `src/hooks/useLeadScoring.ts`
- `src/components/pipeline/LeadCard.tsx`
- `src/components/pipeline/intelligence/AICoachingDashboard.tsx`
- `src/pages/Pipeline.tsx`
- `src/components/layout/TopBar.tsx` (preferences access)

### Dependencies
- No new packages needed; framer-motion (already installed) handles swipe gestures
