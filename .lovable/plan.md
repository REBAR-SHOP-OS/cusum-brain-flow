

# Show File Name with Download & Copy Instead of Raw URLs

## Problem
When a file is attached via a note in the timeline, the storage URL is stored as the activity description and rendered as a raw link. Users see long `https://...storage/...` URLs instead of a clean file card.

## Solution
Create a shared helper component `InlineFileLink` that:
1. Detects storage/Supabase URLs in activity descriptions
2. Extracts the file name from the URL path
3. Renders a styled card with: file icon + file name + Download button + Copy button
4. Non-URL text in the description is rendered normally alongside

## Changes

### 1. New component: `src/components/pipeline/InlineFileLink.tsx`
- Accepts a `url` string and optional `fileName`
- Extracts filename from URL path (last segment, decoded)
- Shows appropriate file icon based on extension (PDF, DWG, XLS, image, etc.)
- Download button: fetches signed URL if it's a storage path, or opens directly
- Copy button: copies the URL to clipboard with toast feedback
- Compact card design matching existing file attachment styling

### 2. New utility: `renderDescriptionWithFiles` helper
- Parses activity description text
- Splits on URL patterns (regex for `https://...storage/...` or any `https://` link)
- Returns mixed JSX: plain text spans + `InlineFileLink` components for each URL

### 3. `src/components/pipeline/LeadTimeline.tsx` (line 484-488)
Replace plain text rendering of `activity.description`:
```
- <p className="...">{activity.description}</p>
+ <div className="...">{renderDescriptionWithFiles(activity.description)}</div>
```

### 4. `src/components/pipeline/OdooChatter.tsx` (line 990-993)
Same replacement for the description fallback in `ActivityThreadItem`:
```
- <p className="...">{activity.description}</p>
+ <div className="...">{renderDescriptionWithFiles(activity.description)}</div>
```

## Visual Result
```text
Before:
┌──────────────────────────────────────────────────┐
│ https://uavzziigfnqpfdkczbdo.supabase.co/storage│
│ /v1/object/public/estimation-files/sales-activit │
│ ies/0c28b52e-59db-49e0-9-62e-561f99727c6c/fd54d5 │
│ 54-d3b4-486e-9f66-60e4836f1a56.pdf               │
└──────────────────────────────────────────────────┘

After:
┌──────────────────────────────────────┐
│ 📄 fd54d554...1a56.pdf  ⬇️ 📋      │
└──────────────────────────────────────┘
```

## Files Changed
- `src/components/pipeline/InlineFileLink.tsx` — new component
- `src/components/pipeline/LeadTimeline.tsx` — use `renderDescriptionWithFiles`
- `src/components/pipeline/OdooChatter.tsx` — use `renderDescriptionWithFiles`
