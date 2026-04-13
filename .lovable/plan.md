

# Remove "Draft with AI" Button

## What's being removed
The "Draft with AI" button (circled in red) — including its UI, tooltip wrapper, and all supporting logic (`handleAutoGenerate`, `isAutoGenerating`, `canAutoGenerate`).

## Changes

### `src/components/ad-director/ChatPromptBar.tsx`

1. **Remove state**: Delete `isAutoGenerating` state (line 181)
2. **Remove derived values**: Delete `canAutoGenerate` (line 192)
3. **Remove handler**: Delete the entire `handleAutoGenerate` async function (lines 206-270)
4. **Remove UI**: Delete the `<Tooltip>` block wrapping the "Draft with AI" button (lines 614-638)
5. **Clean up imports**: Remove `Sparkles` if no longer used elsewhere in this file

The "Create video" button and all other UI elements remain unchanged.

## No backend changes needed

