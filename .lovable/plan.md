
Goal: make each video-history card show an actual video preview when possible, and let the user rename each card directly from the card UI.

What I found:
- `VideoHistory.tsx` already tries to use a draft clip URL, but it only checks a few flat keys and falls back to the Draft placeholder when the saved clip shape differs.
- Draft selection is restored from `AdDirectorContent.tsx`, but card names are currently read-only.
- `useAdProjectHistory.ts` already supports updating an existing project when `saveProject.mutateAsync` receives an `id`, so renaming can reuse the current persistence flow without backend changes.

Implementation plan

1. Strengthen preview URL resolution in `VideoHistory.tsx`
- Add a small helper to resolve the best preview URL for each card.
- Prefer `final_video_url` for completed videos.
- For drafts, scan `project.clips` more defensively:
  - only prefer completed clips first
  - read `videoUrl`, `video_url`, `url`, and common nested URL shapes if present
- Keep the current card click behavior intact:
  - final video → open result view
  - draft → restore draft state

2. Improve card preview behavior
- Keep the `<video>` thumbnail approach, but make it more reliable for visible previews.
- Show the video element whenever a resolved preview URL exists.
- Keep the existing fallback only when no playable URL is found or the media errors.
- Preserve hover-to-play behavior and non-hover play icon overlay.

3. Add inline rename UI to each history card
- Add a small edit action/icon beside the card title area.
- Clicking it switches the title into an input field on that card only.
- Support:
  - save on Enter / check action / blur
  - cancel on Escape
  - prevent card-open click while editing

4. Persist renamed titles through the existing hook
- Extend `VideoHistory` props with an optional rename callback like `onRename(projectId, newName)`.
- In `AdDirectorContent.tsx`, pass a rename handler that calls `saveProject.mutateAsync` with:
  - `id`
  - updated `name`
  - existing project data (`brandName`, `script`, `segments`, `storyboard`, `clips`, `continuity`, `finalVideoUrl`, `status`)
- Show success/error toast feedback for rename.

5. Keep the change surgical and safe
- No database migration needed.
- No change to the overall Ad Director flow, draft restore logic, delete logic, or editor flow.
- Only touch:
  - `src/components/ad-director/VideoHistory.tsx`
  - `src/components/ad-director/AdDirectorContent.tsx`

Technical notes
- `ClipOutput` officially contains `videoUrl`, but saved project JSON may contain alternative shapes, so preview resolution should be tolerant rather than strict.
- Renaming must use the existing update path in `useAdProjectHistory.ts` by supplying `id`; this avoids adding new hooks or backend code.
- The input should stop event propagation so clicking inside rename mode does not reopen the project card.

Validation after implementation
- Draft cards show a real preview if any saved clip has a playable URL.
- Final video cards still preview and download normally.
- Renaming a card updates the title immediately and remains correct after refresh.
- Editing the title does not accidentally open the card.
