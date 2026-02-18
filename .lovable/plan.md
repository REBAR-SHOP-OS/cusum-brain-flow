

# Pipeline Empty States -- Exact Odoo Clone

## Scope
Fix the empty states in all three tabs (Notes, Chatter, Activities) inside the Lead Detail Drawer to be pixel-perfect copies of Odoo 17's empty state. No logic, database, or other changes.

## What Odoo Shows (Reference Screenshot)
When any tab is empty, Odoo shows:
- A clipboard/document icon (centered, large, muted)
- "No activities yet." as primary text
- "Log a note or schedule an activity above." as secondary text
- Clean, spacious layout with generous vertical padding

## Changes

### 1. `src/components/pipeline/LeadDetailDrawer.tsx` -- Notes Tab Empty State
**Current**: FileText icon + "No notes yet."
**Fix**: Match Odoo exactly: same clipboard icon + "No notes yet." + "Add a description or internal note using the edit button above."

### 2. `src/components/pipeline/OdooChatter.tsx` -- Chatter Empty State
**Current**: Already close -- FileText icon + correct text
**Fix**: Minor -- ensure the icon matches Odoo's clipboard style (ClipboardList from lucide) and text exactly matches Odoo

### 3. `src/components/pipeline/ScheduledActivities.tsx` -- Activities Tab Empty State
**Current**: Clock icon + "No activities yet." + "Schedule an activity to get started." + separate "Schedule Activity" button visible
**Fix**: Use same clipboard-style icon (ClipboardList) and Odoo-matching text: "No activities yet." + "Schedule an activity to get started." -- keep the Schedule Activity button but make it subtler

## Technical Details

### Files to modify:
- `src/components/pipeline/LeadDetailDrawer.tsx` (line 254-258: Notes empty state)
- `src/components/pipeline/OdooChatter.tsx` (line 413-421: Chatter empty state icon)
- `src/components/pipeline/ScheduledActivities.tsx` (line 167-177: Activities empty state icon)

### Icon change:
- Replace `FileText` and `Clock` icons in empty states with `ClipboardList` from lucide-react (closest to Odoo's clipboard icon)
- Size: `w-16 h-16`, color: `text-muted-foreground/20`

### No changes to:
- Database, RLS, logic, API
- Any components outside the pipeline drawer tabs
- Existing functionality (schedule, log, send still work)
