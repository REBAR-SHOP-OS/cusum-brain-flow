

# Add AI Image Description Button to Post Review Panel

## What
Add a button (with a sparkle/wand icon) next to "Regenerate image" and "Generate video" that opens the existing `ImageGeneratorDialog`, letting users describe the image they want and have AI generate it.

## How

### File: `src/components/social/PostReviewPanel.tsx`

The `ImageGeneratorDialog` is already imported and wired up (line 789). There's a `showImageGen` state (line 140). Just need to add a button in the visual action row (line 379-410) that sets `showImageGen(true)`.

**Change** (lines 379-410): Add a third button between "Regenerate image" and "Generate video":

```tsx
<div className="flex gap-2">
  {/* existing Regenerate image button */}
  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowImageGen(true)}>
    <Sparkles className="w-3.5 h-3.5" />
    AI Image
  </Button>
  {/* existing Generate video button */}
</div>
```

This button opens the already-functional `ImageGeneratorDialog` where users can describe their desired image and AI generates it. The generated image is then attached to the post via the existing `handleMediaReady` flow.

No new files, no new edge functions, no database changes needed.

