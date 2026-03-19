

# Replace Floating Vizzy Avatar

## What
Replace the current `src/assets/vizzy-avatar.png` with the uploaded image (female character with glasses, black hair bun, yellow top).

## Changes

### 1. Copy uploaded image to project
- Copy `user-uploads://image-1773947930.png` to `src/assets/vizzy-avatar.png` (overwrite existing)

That's it. The `FloatingVizzyButton` component already imports from `@/assets/vizzy-avatar.png`, so no code changes needed. The new face will appear immediately in the floating button.

