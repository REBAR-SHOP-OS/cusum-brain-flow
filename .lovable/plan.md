

# Chatter UI Cleanup — Reduce Noise, Fix Dates, Collapse Emails

## Problem (from screenshots)
1. **"Odoo Sync" noise entries** — generic entries like "Odoo Sync / Walden Homes" pollute the conversation thread with zero actionable content
2. **"Stage Changed" without details** — entries show "Stage Changed" but no from→to tracking info (tracking backfill hasn't run yet for all leads)
3. **Large email blocks** — forwarded emails with signatures and quoted history dominate the thread, burying real conversations
4. **Mixed timeline** — system audit entries (sync events, stage changes) are interleaved with human messages, reducing signal-to-noise

## Plan

### 1. Collapse system/audit entries into a compact "audit rail"
In `OdooChatter.tsx`, change how `stage_change` and `system` type activities render:
- **With tracking data**: show as compact single-line bullets (already works)
- **Without tracking data** (generic "Stage Changed", "Odoo Sync"): render as a **collapsed mini-row** — single line, muted text, no avatar, smaller font. Group consecutive system entries under one collapsible block ("3 system updates — expand")
- This keeps audit trail accessible but stops it from dominating the feed

### 2. Email body: 3-line preview + "Show full email" expand
In `ActivityThreadItem`, for `isEmail` activities:
- Default: show only first ~3 lines (via `line-clamp-3`) of the sanitized HTML
- Strip common quoted-reply patterns (`-----Original Message-----`, `On ... wrote:`, Gmail quote blocks) into a separate collapsed section
- Add "Show full email" / "Hide" toggle
- This is the biggest UX win — emails currently render at full height

### 3. Suppress empty "Odoo Sync" lead_events entries
In the `eventActivities` useMemo, filter out `lead_events` where:
- `event_type` is not a recognized useful type AND
- description/payload is empty or just a company name
- This removes the "Odoo Sync / Walden Homes" noise entries that carry no information

### 4. Thread filter tabs (Conversation vs All vs Audit)
Add a simple 3-toggle filter above the thread:
- **All** (default): everything as today
- **Conversation**: only emails, notes, and communications (hides system/stage_change)
- **Audit**: only stage_change, system entries

This directly addresses the audit recommendation to "separate Chatter into Conversation / Activities / Audit Log".

## Files to modify

| File | Change |
|------|--------|
| `src/components/pipeline/OdooChatter.tsx` | Add thread filter, collapse system entries, email preview with expand, strip quoted replies |

No database or edge function changes needed — this is purely UI.

