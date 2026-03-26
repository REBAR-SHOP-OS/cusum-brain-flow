

# Add Video History to Ad Director Idle Screen

## What
Show all previously created videos (from `ad_projects` table) as a history grid below the prompt bar on the idle screen. Users can see thumbnails, download, or click to reload past projects.

## Data Source
The `ad_projects` table already stores `final_video_url`, `name`, `created_at`, `status`, and `clips` (with individual scene video URLs). The `useAdProjectHistory` hook already fetches this data. We just need to display it.

## Implementation

### 1. New Component: `src/components/ad-director/VideoHistory.tsx`
- Receives `projects` from `useAdProjectHistory`
- Filters to only show projects with a `final_video_url` (completed renders)
- Renders a responsive grid (2-3 columns) of cards, each showing:
  - Video thumbnail (using `<video>` with `preload="metadata"` + hover-to-play)
  - Project name + date (formatted with `date-fns`)
  - Download button
  - Click to reload into the player
- Empty state: hidden (no message if no history)

### 2. Update `AdDirectorContent.tsx`
- In the `idle` flowState block (line 263-275), after `<ChatPromptBar>`, render `<VideoHistory>` component
- Pass `projects.data` from the existing `useAdProjectHistory` hook (already imported)
- On card click: set `selectedPreviewUrl` and switch to result view, or open video in a modal

### Layout
```text
[  Hero: "What video do you want to create?"  ]
[  Upload slots: Intro | Character | Outro     ]
[  ChatPromptBar                                ]
[  ──── Your Previous Videos ────               ]
[  [Video 1]  [Video 2]  [Video 3]             ]
[  [Video 4]  [Video 5]  ...                   ]
```

## Files Changed

| File | Change |
|---|---|
| `src/components/ad-director/VideoHistory.tsx` | New component — grid of past rendered videos with thumbnails, names, dates, download |
| `src/components/ad-director/AdDirectorContent.tsx` | Add `VideoHistory` to idle state, pass projects data |

