

# Fix: Add Loading Spinner & Page Scrolling

## Issues
1. **No loading indicator** — The "Analyzing Script..." button shows text but needs a spinning gear/loader icon for visual feedback.
2. **No page scroll** — The page content is clipped without a scrollbar.

## Changes

### 1. `src/components/ad-director/ScriptInput.tsx`
- Add `Loader2` import from lucide-react (spinning gear icon)
- In the Analyze button, when `analyzing` is true, show `<Loader2 className="animate-spin" />` alongside the "Analyzing Script..." text

### 2. `src/pages/AdDirector.tsx`
- The outer div already has `overflow-y-auto` — but the content div uses `flex-1` which can constrain height. Remove `flex-1` from the content wrapper to allow natural document flow and scrolling.

### 3. `src/components/ad-director/AdDirectorContent.tsx`
- Ensure the main wrapper div doesn't have height constraints that prevent scrolling. The `space-y-6` div should flow naturally.

Two small edits, no structural changes.

