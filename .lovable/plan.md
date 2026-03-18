

## Two Fixes: "Apply 0 Fix" Button + Delete Low-Value Pages

### Issue 1: "Apply 0 Fix" Despite Valid Proposal Visible

The button count on line 471 filters by `!p.error && p.before_paragraph`. The screenshot shows a proposal with action "replace" and a replacement URL, but BEFORE/AFTER blocks appear to have content. The likely cause: `before_paragraph` might be an empty string `""` (falsy) when the action is "replace" — the edge function may not always populate these fields for replace-type fixes.

**Fix in `src/components/seo/SeoLinks.tsx`:**
- Update the valid proposal filter (lines 158 and 471) to also count proposals where `action === "replace" && replacement_url` exists, even if `before_paragraph` is empty
- Change filter from: `!p.error && p.before_paragraph`
- To: `!p.error && (p.before_paragraph || (p.action === "replace" && p.replacement_url))`
- Apply same logic in `handleApproveAll`

### Issue 2: Delete Low-Value / Garbage Pages

Add a delete option to `SeoPages.tsx` for pages with no SEO traffic/value.

**File: `src/components/seo/SeoPages.tsx`:**
- Add a `Trash2` icon button on each row
- Add selection checkboxes for bulk delete
- Add a "Delete Selected" button in the toolbar
- Add a filter/sort to surface garbage pages (score=0, impressions=0, clicks=0, sessions=0)
- Add a quick "Select All Garbage" button that auto-selects pages where all traffic metrics are 0
- Confirmation dialog before deleting
- Delete from `seo_page_ai` table via supabase

### Files to Change
- `src/components/seo/SeoLinks.tsx` — fix valid proposal counting
- `src/components/seo/SeoPages.tsx` — add delete functionality with bulk select

