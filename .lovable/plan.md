

# Remove Source Footage Section from ChatPromptBar

## What's being removed
The entire "Source footage" block — the upload button, clip list, empty state placeholder, and all related state/logic.

## Changes

### `src/components/ad-director/ChatPromptBar.tsx`

1. **Remove state & refs**: Delete `sourceClips` state, `sourceClipRef` ref, `handleSourceClipChange`, `removeSourceClip`, `formatFileSize` (if only used here)
2. **Remove UI block** (lines 363-419): The hidden file input + the entire `rounded-[28px]` card with "Source footage" heading, "Add video clips" button, clip list, and empty state
3. **Clean up submit**: Remove `sourceClips` from `handleSubmit` call — pass empty array `[]` instead
4. **Clean up context builder**: Remove the `sourceClipLabels` line and the `if (sourceClips.length > 0)` context push
5. **Clean up summary pills** (lines 438-442): Remove the "Footage: N clips" badge
6. **Clean up `canAutoGenerate`**: Remove `sourceClips.length > 0` from the condition
7. **Clean up empty-state text** (line 443-445): Remove `sourceClips.length === 0` from the condition
8. **Remove `Video` icon import** if no longer used
9. **Remove `formatFileSize` helper** if only used for source clips

### `onSubmit` prop type
The parent component passes `sourceClips` as the 3rd argument. We'll pass `[]` to keep the interface stable and avoid breaking the parent.

## No backend changes needed

