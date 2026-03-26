

# Hide Image Uploads & Prompt Bar from Result View

## What
Remove the ChatPromptBar (which includes Intro Image, Character, Outro Image upload boxes AND the prompt input) from the "result" state view. The user indicated these should not be visible after scenes are generated.

## Change

### `src/components/ad-director/AdDirectorContent.tsx`
- **Delete lines 417-421** — remove the entire `{/* New prompt */}` section that renders `<ChatPromptBar>` in the result view
- The prompt bar remains visible only in the "idle" state (line ~280) where it belongs

This is a single deletion — no other files need changes.

