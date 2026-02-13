
# Hide Emailed Prospects from Prospecting Page

## Problem
After sending an email, prospects with "emailed" status still appear on the Prospecting page. Since they've been auto-approved and have a lead in the pipeline, they should no longer clutter the prospecting view.

## Change

### `src/pages/Prospecting.tsx` -- Filter out emailed prospects from the query

Add `.neq("status", "emailed")` to the prospects query (around line 60) so emailed prospects are excluded at the database level. This means:

- Prospects disappear from the Prospecting page once emailed
- They remain accessible as leads on the Pipeline page
- The status filter toggle for "Emailed" will also be removed from `ProspectingFilters` since it's no longer relevant
- Count displays will reflect only active (non-emailed) prospects

### `src/components/prospecting/ProspectingFilters.tsx` -- Remove "Emailed" toggle

Remove the `statusEmailed` filter toggle since emailed prospects won't appear on this page anymore.

## Result
- Emailed prospects vanish from the Prospecting page immediately after sending
- They live on as leads in the Pipeline under the "prospecting" stage
- Cleaner prospecting view focused only on pending/approved/rejected prospects
