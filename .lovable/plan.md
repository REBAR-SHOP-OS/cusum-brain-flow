

# Fix: AI Command Bar Should Regenerate Scene After Prompt Edit

## Problem
The AI command bar updates the scene's text prompt but doesn't regenerate the video. The user types "Add logo in Hard Hats", the prompt text changes, but the video stays the same — no visible effect.

## Fix
After the AI edits the prompt via `edit-video-prompt`, automatically trigger `onRegenerateScene` for that scene so the new prompt produces an updated video.

## Changes

### `src/components/ad-director/ProVideoEditor.tsx`
In `handleAiSubmit`, after `onUpdateStoryboard?.(updated)` succeeds, call `onRegenerateScene?.(scene.id)` to kick off video regeneration with the new prompt. Add a toast indicating regeneration has started.

```typescript
onUpdateStoryboard?.(updated);
onRegenerateScene?.(scene.id);  // ← add this
toast({ title: "Regenerating scene", description: "AI is applying your edit..." });
```

This connects the existing regeneration pipeline to the AI command bar so edits actually produce new video output.

## Files Modified
- `src/components/ad-director/ProVideoEditor.tsx` — add `onRegenerateScene` call after prompt update

