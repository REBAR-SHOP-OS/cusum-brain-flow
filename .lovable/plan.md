

# Add Per-Page Publishing Status Dropdown to Post Cards

## Problem
When a post fails on one specific page (e.g., "rebar.shop_on"), the card just shows "Failed" with no way to see which page(s) succeeded or failed.

## Solution
Add a collapsible/expandable chevron icon next to the "Pages (N)" label on post cards in `SocialCalendar.tsx`. When expanded, it shows each page name with a success/fail indicator parsed from `last_error`.

## Changes

### 1. `src/hooks/useSocialPosts.ts`
- Add `last_error: string | null` to the `SocialPost` interface

### 2. `src/components/social/SocialCalendar.tsx`
- Import `ChevronDown` icon and `Collapsible` components
- On the post card, wrap "Pages (N)" in a collapsible trigger with a small chevron icon
- The collapsible content shows each page from `page_name` (split by ", ") as a row
- For failed/partial posts: parse `last_error` string to match page names and mark them red; others show green
- For published posts: all pages show green checkmarks
- For scheduled/draft: just list page names neutrally
- Click on the chevron stops event propagation (doesn't open the post review panel)

### Parsing Logic
The `last_error` field stores errors like: `Partial: Page "Rebar.shop Ontario": Some error; Page "Ontario Steel": Another error` or `Page "X": error message`. Parse page names from error string and match against page_name list to determine per-page status.

## Impact
- 2 files changed
- No database or edge function changes
- Purely UI enhancement

