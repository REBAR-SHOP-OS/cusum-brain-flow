

# Persistent Vizzy Agent with End-of-Day CEO Report

## Overview

Add a floating Vizzy avatar button that stays visible on every page, opens the AI assistant chat on click, and set up an automated 6 PM daily report to the CEO summarizing the day's activity.

---

## Part 1: Floating Vizzy Avatar Button

A circular avatar button (matching the uploaded image style -- the Vizzy character with glasses and teal ring) will be pinned to the bottom-right corner of every page.

**Behavior:**
- Always visible on all pages (rendered in `AppLayout`)
- Pulsing teal ring to indicate Vizzy is "watching" / active
- Click opens the existing Live Chat panel (reuses `LiveChatWidget` / `useAdminChat` which already streams to the `admin-chat` edge function)
- On mobile, positioned above the bottom nav bar

**Implementation:**
- Create `src/components/vizzy/FloatingVizzyButton.tsx` -- a fixed-position avatar button with the Vizzy character image, teal ring animation, and click handler that dispatches the existing `toggle-live-chat` custom event
- Copy the uploaded Vizzy avatar image to `src/assets/vizzy-avatar.png`
- Add `FloatingVizzyButton` to `AppLayout.tsx` alongside the existing `LiveChatWidget`

---

## Part 2: Activity Supervision Context

Update the `admin-chat` edge function system prompt to include awareness of user activity. When the Live Chat opens, Vizzy will already have context about:
- Current page the user is on
- Recent activity events
- Any open suggestions or alerts

This is lightweight -- it enhances the existing `admin-chat` system prompt with a brief activity snapshot fetched at chat open time.

---

## Part 3: Automated 6 PM CEO Report

Schedule the existing `daily-team-report` edge function to run automatically at 6 PM EST every day via a cron job.

**How it works:**
1. The `daily-team-report` edge function already compiles a full day summary (comms, tasks, leads, orders, work orders, deliveries, time clock entries, chat sessions, meetings)
2. A database cron job (`pg_cron` + `pg_net`) will call this function at 6 PM EST (11 PM UTC / 23:00)
3. The result is saved as a notification for the CEO and also stored as a Vizzy chat session so the CEO can see it when they open Vizzy

**Database changes:**
- SQL to create the cron schedule calling `daily-team-report` at 23:00 UTC (6 PM EST)
- A small update to `daily-team-report` to also insert the summary as a notification for the CEO user

---

## Summary of Changes

| Item | Type | Details |
|------|------|---------|
| `src/components/vizzy/FloatingVizzyButton.tsx` | New file | Floating avatar with teal ring, dispatches `toggle-live-chat` event |
| `src/assets/vizzy-avatar.png` | New asset | Vizzy character avatar image |
| `src/components/layout/AppLayout.tsx` | Edit | Add `FloatingVizzyButton` component |
| `supabase/functions/daily-team-report/index.ts` | Edit | Add notification insert for CEO + auto-save as chat session |
| Database (cron) | SQL insert | Schedule `daily-team-report` at 6 PM EST daily |

