

# Update Floating Vizzy Button Avatar

## What
Replace the current Vizzy avatar image in the floating button with the new uploaded image (the woman with glasses).

## Changes

### 1. Copy the new avatar image to project assets
- Copy `user-uploads://Screenshot_2026-03-19_151107.png` to `src/assets/vizzy-avatar.png` (overwrite existing)

### 2. No code changes needed
Since `FloatingVizzyButton.tsx` already imports from `@/assets/vizzy-avatar.png`, replacing the file is sufficient — the button will automatically use the new image.

