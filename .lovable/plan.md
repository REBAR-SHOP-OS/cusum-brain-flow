
# CRM Pipeline -- Exact Odoo 17 Parity Audit and Fix

## Summary
After auditing every pipeline component against Odoo 17 CRM behavior, the following gaps need to be closed. The goal: a sales rep cannot tell they are not in Odoo.

---

## Gap 1: Pipeline Board -- Column Header Missing Odoo Revenue Format

**Current**: Column header shows abbreviated revenue (e.g. "145K") next to a count badge.
**Odoo**: Shows the full revenue in the column header as a currency value (e.g. "$145,230") and the count is inside the stage name area. No progress bar under the header in Odoo.

**Fix**: Remove the revenue progress bar from `PipelineColumn.tsx`. Display revenue as a full formatted currency value (not abbreviated) next to the count, matching Odoo's exact layout.

---

## Gap 2: Lead Card -- Border-Left Signal Colors Are Not Odoo

**Current**: Cards have a colored left border based on a complex "signal" system (overdue, stale, on track, etc.) -- this is an ERP invention, not Odoo behavior.
**Odoo**: Cards have NO colored left border. Cards are flat white with subtle border. The only color signal is the activity status indicator (a small colored circle: green/orange/red) for scheduled activities.

**Fix**: Remove the `border-l-4` signal border from `LeadCard.tsx`. Replace with an Odoo-style activity status indicator (small dot) based on next planned activity status (overdue = red, today = orange, future = green, none = grey).

---

## Gap 3: Lead Card -- Three-Dot Menu Visible on Hover Is Not Odoo

**Current**: A `MoreHorizontal` dropdown appears on hover with Edit/Delete.
**Odoo**: Cards do NOT have a three-dot menu. You click the card to open the form view (our drawer), and actions are taken from there.

**Fix**: Remove the `DropdownMenu` from `LeadCard.tsx`. The card already has an `onClick` handler that opens the drawer -- that is the Odoo pattern.

---

## Gap 4: Lead Card -- Revenue Display

**Current**: Revenue shown as `$X` with CAD locale formatting.
**Odoo**: Revenue shown at the bottom of the card in the format `$ 145,230.00` (two decimal places, dollar sign with space).

**Fix**: Move revenue to the bottom row and format with two decimal places, matching Odoo's display.

---

## Gap 5: Lead Card -- Activity Icons Row

**Current**: Shows Sparkles (AI stale), Mail, MessageSquare icons in bottom row.
**Odoo**: Shows a single activity status indicator (colored clock icon or dot) and the expected revenue. No AI sparkle icon on cards.

**Fix**: Remove Sparkles/Mail/MessageSquare activity icons from the card face. Add an activity status indicator (colored clock) that reflects the next planned activity's due date status.

---

## Gap 6: Pipeline Header -- Too Many Buttons

**Current**: Header has Scan RFQ, Odoo Sync, Prospect, Blitz (AI), Add Lead buttons.
**Odoo**: Header has only "New" (create) button prominently. Other actions are in a smaller actions menu or separate views.

**Fix**: Keep "Add Lead" as the primary action (rename to "New" to match Odoo). Move Scan RFQ, Odoo Sync, Prospect, Blitz into an overflow menu (three-dot or "Actions" dropdown) so the header is clean like Odoo.

---

## Gap 7: Pipeline Analytics Bar

**Current**: Shows Pipeline Value, Weighted Forecast, Win Rate, Avg Deal inline in the header.
**Odoo**: Does NOT show analytics in the pipeline kanban header. Analytics are in a separate reporting view.

**Fix**: Remove `PipelineAnalytics` from the pipeline header. This data can remain accessible from a separate analytics/reporting page.

---

## Gap 8: Lead Detail Drawer -- Tab Structure

**Current**: 7 tabs: Email, Timeline, Details, Files, $, Notes, AI.
**Odoo**: The form view has a top section (header fields) and a bottom section with Chatter only. There are no separate tabs for Email, Files, Notes, AI in the Odoo CRM form.

**Fix**: Reduce to 2 tabs matching Odoo: "Internal Notes" (description/notes fields) and "Chatter" (the OdooChatter timeline, which already includes file attachments inline). Email thread can be folded into the Chatter as email-type activities. Remove the standalone AI and Financials tabs (probability/revenue are already shown in the header section).

---

## Gap 9: Search/Filter Bar

**Current**: Custom smart search with AI sparkle icon and magic keyword parsing.
**Odoo**: Simple search bar with magnifying glass icon. Filter dropdown has Filters, Group By, and Favorites columns -- which we already have. The smart-search "magic" is fine to keep since it doesn't change the visual UX.

**Fix**: Replace the Sparkles icon with a Search (magnifying glass) icon in the search bar to match Odoo's visual.

---

## Technical Implementation Sequence

1. **PipelineColumn.tsx** -- Remove revenue progress bar, show full currency value
2. **LeadCard.tsx** -- Remove border-l signal, remove dropdown menu, remove activity icons, add Odoo activity dot, reformat revenue
3. **Pipeline.tsx (header)** -- Remove PipelineAnalytics, consolidate buttons into overflow menu, rename "Add Lead" to "New", swap Sparkles for Search icon
4. **PipelineFilters.tsx** -- Replace Sparkles icon with Search icon
5. **LeadDetailDrawer.tsx** -- Reduce tabs from 7 to 2 (Internal Notes + Chatter), keep header metadata section as-is
6. **OdooChatter.tsx** -- No changes needed (already Odoo-parity)

All changes are frontend-only. No database migrations. No edge function changes.
