

## Problem
After analyzing and generating, the user expects to **always** land on the **Result view** (image-528) which shows the "Generated Scenes" card gallery with each scene as a clickable thumbnail (and a retry button for failed ones).

But currently, in `backgroundAdDirectorService.ts` line 678-688: if **any** scene fails after retries (`unresolvedCount > 0`), the pipeline jumps to `flowState: "editing"` (ProVideoEditor — full timeline editor) instead of `"result"`. The user never sees the simple cards view in this case.

## Root Cause
```ts
// backgroundAdDirectorService.ts line 682
if (unresolvedCount > 0) {
  this.update({ flowState: "editing", ... });  // ← wrong destination
  return;
}
// ... later
this.update({ flowState: "result", ... });  // ← only reached when 100% succeed
```

The Result view already handles partial failures gracefully (line 550-560 in `AdDirectorContent.tsx`): failed scenes show an `AlertCircle` icon with a `RefreshCw` retry button — exactly what the user wants.

## Fix (single file, surgical)

**`src/lib/backgroundAdDirectorService.ts`** (lines ~678-695):

1. **Always go to `flowState: "result"`** after generation completes — regardless of whether some scenes failed.
2. Still attempt the stitch/export when possible; if some scenes failed, skip stitching but show the cards.
3. Keep the toast warning so the user knows some scenes need retry, but don't redirect them to the editor.

```ts
const unresolvedCount = this.state.clips.filter(c => c.status !== "completed" || !c.videoUrl).length;

if (unresolvedCount > 0) {
  toast.warning(`${unresolvedCount} scene(s) failed. Click the retry icon on each card.`);
  // DO NOT switch to editing — stay on result view so user sees all cards
} else {
  // All succeeded → stitch final video
  this.update({ statusText: "Assembling final video...", progressValue: 90 });
  await this.handleExportInternal(storyboardWithDefaults, newSegments, brand);
  await this.uploadCompletedClips();
}

this.update({ flowState: "result", statusText: "", progressValue: 100 });
this.running = false;
```

## What Stays the Same
- Result view UI (cards gallery, retry buttons, preview player) — no change
- ProVideoEditor — still accessible via "Approve Composition" → "Edit Video" button
- Scene retry logic (`handleRegenerateScene`) — no change
- DB sync on completion — no change

## Result
- After analyze + generate → **always** lands on Result view with scene cards visible
- Failed scenes show retry icon directly on the card (existing behavior)
- Successful scenes show video thumbnails as before
- User can preview, retry individual failures, save draft, or approve to enter the editor — all from the cards view

