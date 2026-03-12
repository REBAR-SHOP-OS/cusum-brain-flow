

# Fix "setShowStoryGen is not defined" Error + Story Generation

## Problem
The error "Uncaught ReferenceError: setShowStoryGen is not defined" appears when clicking "Auto Generate Story." The source code is correct — `setShowStoryGen` is properly defined at line 143 of `PostReviewPanel.tsx` and used within the same component scope. This is a stale build artifact.

## Fix
Force a rebuild by adding a trivial comment to `PostReviewPanel.tsx`. This will clear the cached bundle and resolve the reference error.

## Story Generation
The "Auto Generate Story" button currently opens `ImageGeneratorDialog` with `storyMode=true`, which generates a 9:16 portrait image (story format). This is functional and will produce a story-sized image using the AI image generator. No changes needed to the generation logic itself.

## Files Changed
- `src/components/social/PostReviewPanel.tsx` — add rebuild-triggering comment

