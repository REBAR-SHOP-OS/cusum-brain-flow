

# Show Thumbnail Image on Draft Video Cards

## Problem
All 6 draft cards in the screenshot show only text descriptions instead of images. The user expects to see the first frame/image of each video project. However, these drafts have `idle` clips — videos were never generated, so there are no video frames to extract.

## Solution
Generate a lightweight AI thumbnail image when a project is first saved, store it in the `ad_projects` table as `thumbnail_url`, and display it on the card.

## Changes

### 1. Database Migration
Add a `thumbnail_url` column to `ad_projects`:
```sql
ALTER TABLE ad_projects ADD COLUMN thumbnail_url text;
```

### 2. `src/lib/backgroundAdDirectorService.ts`
After the storyboard is generated (before video generation starts), generate a quick thumbnail image using the Lovable AI image model (`google/gemini-3.1-flash-image-preview`) via the existing edge function infrastructure. Use the first scene's prompt, store the result in `ad-assets` storage, and save the URL to `thumbnail_url` on the project row.

### 3. `src/hooks/useAdProjectHistory.ts`
- Add `thumbnail_url` to `AdProjectRow` interface
- Include it in the save mutation payload

### 4. `src/components/ad-director/VideoHistory.tsx`
- Add a `resolveThumbnailUrl` helper that checks `project.thumbnail_url`
- In the card's fallback (when no video URL exists), show the thumbnail image instead of text:
  ```
  {thumbnailUrl ? (
    <img src={thumbnailUrl} className="w-full h-full object-cover" />
  ) : (
    // existing text fallback
  )}
  ```

### 5. `src/components/ad-director/AdDirectorContent.tsx`
Pass `thumbnail_url` when saving projects.

## Visual Result
```text
┌─────────────────────────┐
│ [Draft]                 │
│  ┌───────────────────┐  │
│  │  AI-generated     │  │
│  │  thumbnail image  │  │
│  └───────────────────┘  │
├─────────────────────────┤
│ Macro shot of steel…  🗑│
│ Mar 26, 2026            │
└─────────────────────────┘
```

## Files Changed
- Migration: add `thumbnail_url` column
- `src/lib/backgroundAdDirectorService.ts` — generate thumbnail after storyboard
- `src/hooks/useAdProjectHistory.ts` — add `thumbnail_url` to type and save
- `src/components/ad-director/VideoHistory.tsx` — show thumbnail image on cards
- `src/components/ad-director/AdDirectorContent.tsx` — pass thumbnail in save calls

