
# Pipeline Drawer Tabs Audit & Odoo Clone Polish

## Scope
Only the **Chatter, Notes, and Activities** tabs inside the Lead Detail Drawer. No changes to Pipeline board, cards, columns, header, database, or logic.

## What the Reference Shows (Odoo 17)
The user's screenshot shows the Chatter tab open with:
1. Three action buttons at top: **"Log note" | "Send message" | "Schedule activity"** -- plain text, no background, separated by spacing (not tabs with underlines)
2. A large centered empty state with a **clipboard/document icon** and text: "No activities yet." / "Log a note or schedule an activity above."
3. The overall area is clean, no borders between the action bar and the empty state

## Current Issues Found

### 1. OdooChatter.tsx -- Composer Tab Bar
- **Current**: Uses underline-style tabs with `h-0.5 bg-primary` active indicator
- **Odoo**: Uses plain text buttons without underline, just font-weight/color difference
- Fix: Remove underline indicator, use bolder text for active state

### 2. OdooChatter.tsx -- Empty State
- **Current**: Icon is `FileText` at `w-10 h-10` with `text-muted-foreground/30`
- **Odoo**: Uses a larger clipboard-style icon, more visible (not as faded)
- Fix: Increase icon size to `w-16 h-16`, lighten to `text-muted-foreground/20` for exact Odoo match

### 3. LeadDetailDrawer.tsx -- Notes Tab Empty State
- Already has FileText icon + "No notes yet." -- matches Odoo
- Minor: icon could be slightly larger for consistency

### 4. ScheduledActivities.tsx -- Empty State
- Already has Clock icon + text -- matches Odoo
- The "Schedule Activity" button at top should not show when in the Activities tab (the chatter already has "Schedule activity" button)
- Keep as-is since it's the Activities tab, not chatter

### 5. LeadDetailDrawer.tsx -- Tab Underline
- **Current**: `h-0.5` underline
- **Odoo**: `h-[2px]` underline (slightly thicker)
- Fix: Change to `h-[2px]`

## Files to Modify

### `src/components/pipeline/OdooChatter.tsx`
- Line 259-277: Restyle composer tab bar -- remove underline indicator, use Odoo plain-button style
- Line 416-424: Adjust empty state icon size to be larger (w-16 h-16) matching Odoo's more prominent clipboard icon

### `src/components/pipeline/LeadDetailDrawer.tsx`
- Line 231: Change tab underline from `h-0.5` to `h-[2px]`
- Line 255-258: Make Notes empty state icon slightly larger for consistency

### `src/components/pipeline/ScheduledActivities.tsx`
- Line 169-177: Make empty state icon larger (w-16 h-16) for consistency with Odoo

## Technical Details
- All changes are CSS/className only
- No logic, data model, API, or database changes
- No changes outside the pipeline directory
