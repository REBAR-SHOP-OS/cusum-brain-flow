

# Add Draft Save Button to Ad Director Result View

## Problem
In the result view (where scenes are shown after generation), there's no way to save the current project as a draft. The user wants a "Save Draft" icon next to the "Approve Composition" button so that all generated scene cards are saved and appear in the VideoHistory section on the home screen.

## Changes

| File | Change |
|---|---|
| `src/components/ad-director/AdDirectorContent.tsx` | Add a "Save Draft" button (with `Save` or `FileDown` icon) next to the "Approve Composition" button in the action buttons section (line ~583-596). On click, it calls `saveProject.mutateAsync` with current state (name, segments, storyboard, clips, continuity) and status `"draft"`, then shows a success toast. Also add a `BookmarkCheck` icon import. |
| `src/components/ad-director/VideoHistory.tsx` | Update the filter (line 16-17) to also show draft projects (those without `final_video_url` but with clips data). Show a "Draft" badge on draft cards. Use the first clip's video URL as thumbnail for drafts. When a draft is selected, restore it into the pipeline state instead of just setting `finalVideoUrl`. |

## Detail

### Draft Save (AdDirectorContent.tsx)
- New button with `BookmarkCheck` icon beside "Approve Composition"
- Saves: `name: brand.name`, `segments`, `storyboard`, `clips`, `continuity`, `status: "draft"`
- Uses existing `saveProject.mutateAsync`
- Shows toast on success

### Draft Display (VideoHistory.tsx)
- Remove the filter that requires `final_video_url`
- For drafts (no `final_video_url`), use the first completed clip's `videoUrl` as thumbnail
- Show a small "پیش‌نویس" (Draft) badge overlay
- `onSelect` for drafts passes project data to restore state

