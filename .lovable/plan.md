

# AI Video Director — Bug Fixes & Stability Audit

After reviewing all files, I found several concrete bugs that cause the "mixing all together" behavior, plus stability issues from the last round of changes.

## Bugs Found

### 1. Script textarea never appears after "Paste a script" click
**File**: `ScriptInput.tsx` line 161
The condition `(script.trim() || (!showAiWriter && script === "")) && script !== ""` is contradictory — it requires `script !== ""` but the "Paste a script" button sets script to `" "` then `""` after 50ms, so the textarea vanishes immediately. The empty state re-appears instead of the textarea.

**Fix**: Simplify the condition to `script.trim().length > 0` — only show the textarea when there's actual content. Add a `manualEdit` state flag that the "Paste a script" button sets, which keeps the textarea visible even when empty.

### 2. Prompt undo never works on first edit
**File**: `usePromptHistory.ts`
`canUndo` requires `>= 2` entries, but `push` is only called once per edit (with the old prompt). After one edit the stack is `[oldPrompt]` — length 1, so `canUndo` returns false. The initial prompt from analysis is never pushed.

**Fix**: In `AdDirectorContent.tsx` `handlePromptChange`, push the current prompt AND also ensure the initial prompt gets pushed on first edit. Change `canUndo` threshold to `>= 1`.

### 3. Multi-build clips race condition
**File**: `AdDirectorContent.tsx` lines 596-618
`handleGenerateAll` calls `setClips(newBuilds[b].clips)` to swap the active clip set, then calls `generateScene` which also calls `setClips`. React batches state updates, so the snapshot on line 609 may capture stale data from the wrong build. This is the "mixing all together" issue.

**Fix**: Instead of swapping the global `clips` state between builds, track the active build index and have `generateScene` write directly to the correct build's clip array. Use a ref to track which build is active during generation.

### 4. Floating sidebar has no mobile backdrop
**File**: `AdDirectorContent.tsx` line 879
The fixed-position panel overlaps content on mobile with no way to dismiss by tapping outside.

**Fix**: Add a semi-transparent backdrop overlay that calls `onActiveTabChanged(null)` on click.

### 5. No cancel button for generation polling
The plan specified adding cancel, but it was not implemented. Polling runs for up to 10 minutes with no user control.

**Fix**: Add an `AbortController` ref. Show a "Cancel" button in the global progress bar. On cancel, set all generating clips to "cancelled" status.

## Files to Edit

| File | Changes |
|------|---------|
| `src/components/ad-director/ScriptInput.tsx` | Fix textarea visibility condition |
| `src/hooks/usePromptHistory.ts` | Fix canUndo threshold |
| `src/components/ad-director/AdDirectorContent.tsx` | Fix multi-build race condition, add cancel generation, add mobile backdrop, fix initial prompt push |

No database changes. No edge function changes.

