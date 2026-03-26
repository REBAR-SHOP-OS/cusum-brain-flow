

# Add Delete Button to Video History Cards

## What
Add a trash/delete icon next to the download button on each video history card. Clicking it will delete the project from the database using the existing `deleteProject` mutation from `useAdProjectHistory`.

## Changes

### `src/components/ad-director/VideoHistory.tsx`

1. **Props**: Add `onDelete?: (id: string) => void` to both `VideoHistoryProps` and `VideoCard` props
2. **Import**: Add `Trash2` from lucide-react
3. **VideoCard**: Add a delete button next to the download button with `e.stopPropagation()`, matching the download button style but with red hover color
4. **Pass through**: `VideoHistory` passes `onDelete` down to each `VideoCard`

### Where `VideoHistory` is used — pass `deleteProject`

Find the parent that renders `<VideoHistory>` and pass `onDelete={deleteProject.mutate}` from `useAdProjectHistory`.

| File | Change |
|---|---|
| `VideoHistory.tsx` | Add `Trash2` delete button next to download, with `onDelete` callback |
| Parent component | Pass `deleteProject.mutate` as `onDelete` prop |

