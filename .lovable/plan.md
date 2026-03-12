

# Fix: AI Command Bar Regeneration Uses Stale Prompt

## Problem
When the AI command bar edits a prompt and calls `onRegenerateScene`, the `generateScene` callback still reads the **old** storyboard from its React closure because `setStoryboard` is asynchronous. The video regenerates with the original prompt, not the AI-edited one.

## Fix

### 1. Store storyboard in a ref for real-time access (`AdDirectorContent.tsx`)
Add a `storyboardRef` that always holds the latest storyboard. Update `generateScene` to read from `storyboardRef.current` instead of the closure-captured `storyboard`.

### 2. Keep ref in sync
Add a `useEffect` that syncs `storyboardRef.current = storyboard` on every update.

### 3. Update `generateScene` to use the ref
Change `const scene = storyboard.find(...)` → `const scene = storyboardRef.current.find(...)` so it always gets the latest prompt, even when called immediately after `setStoryboard`.

## Files Modified
- `src/components/ad-director/AdDirectorContent.tsx` — add `storyboardRef`, update `generateScene` to use it

