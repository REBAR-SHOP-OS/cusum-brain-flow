

# Multi-Select Pages for Publishing to Multiple Accounts

## Problem
The Pages selector currently only allows selecting one page at a time (radio button style). The user wants to select multiple pages simultaneously so posts can be published to multiple Instagram/Facebook/LinkedIn accounts at once.

## Solution

### 1. Add multi-select mode to `SelectionSubPanel`
- Add optional `multiSelect` prop and `onSaveMulti` callback
- When `multiSelect` is true, use checkboxes (square) instead of radio buttons (circle)
- Track an array of selected values instead of a single string
- Save button returns `string[]`

### 2. Update `PostReviewPanel` for multi-page selection
- Change `localPage` from `string` to `string[]` (default: `["Ontario Steel Detailing"]`)
- Update the Pages display to show count or comma-separated names
- Update `handlePageSave` to accept `string[]`

### 3. Update publish logic to publish to all selected pages
- Loop through `selectedPages` and call `publishPost` for each page
- Show combined success/failure feedback

### Files to edit
1. `src/components/social/SelectionSubPanel.tsx` — Add `multiSelect` mode with checkboxes
2. `src/components/social/PostReviewPanel.tsx` — Use multi-select for pages, update publish to loop through selected pages

