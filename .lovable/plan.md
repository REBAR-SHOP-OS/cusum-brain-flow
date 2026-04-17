

## Diagnosis (root cause)

### Issue 1 — Video doesn't display when entering
Two related root causes:

**A.** `flowState` goes directly to `"editing"` after generation (line 761 of `backgroundAdDirectorService.ts`). The editor uses:
```ts
const videoSrc = finalVideoUrl || selectedClip?.videoUrl || null;
```
- If `handleExportInternal` succeeded → `finalVideoUrl` is the basic stitched webm (good)
- If even one scene failed → no `handleExportInternal` runs → `finalVideoUrl` stays `null`
- Fallback uses `selectedClip = clips.find(c => c.sceneId === storyboard[0].id)`. If `selectedSceneIndex=0` points to a scene whose clip is `failed` or `null`, the editor shows **"No video — generate scenes first"** even though OTHER clips are completed.

**B.** When entering from idle (a fresh page load) and clicking a project from "Recent projects", the `onSelect` handler (line 468) sets `flowState: "result"` with only `finalVideoUrl` — but `clips`, `storyboard`, `segments` are NOT restored. If the user then clicks "Edit Video", the editor opens with empty `clips` and `storyboard`, so `selectedClip` is `undefined` → no video.

### Issue 2 — Character prompt icon is missing
Looking at `ChatPromptBar.tsx`:
- The "Character" button exists at line 705 (bottom action row), but it's an unintuitive location — separate from the upload card.
- There is **no inline prompt icon on the Character reference card itself** (`ReferenceUploadCard`, lines 112–180 have no prompt button slot).
- User expects: a small "✏️ prompt" icon directly **on** the character reference card (visible after upload), so the flow is "upload image → click pencil on card → write what character does".
- The bottom-row "Character" button is easily missed and looks like just another filter chip.

## Plan (Surgical, Additive)

### Fix 1 — Editor always shows the right video

**1.A** In `ProVideoEditor.tsx`, change initial scene selection to point to the **first completed clip**, not always index 0:
```ts
const firstCompletedIdx = Math.max(0, storyboard.findIndex(s => 
  clips.find(c => c.sceneId === s.id && c.status === "completed" && c.videoUrl)
));
const [selectedSceneIndex, setSelectedSceneIndex] = useState(firstCompletedIdx);
```

**1.B** Smarter `videoSrc` fallback chain:
```ts
const videoSrc = finalVideoUrl 
  || selectedClip?.videoUrl 
  || clips.find(c => c.status === "completed" && c.videoUrl)?.videoUrl  // any completed clip
  || null;
```

**1.C** When user clicks a project in "Recent projects" and it has `clips`/`storyboard`, hydrate the full state into the service (currently only `finalVideoUrl` is set). In `AdDirectorContent.tsx` line 468:
```ts
onSelect={(url, project) => {
  service.patchState({
    finalVideoUrl: url,
    clips: project?.clips ?? [],
    storyboard: project?.storyboard ?? [],
    segments: project?.segments ?? [],
    flowState: "result",
  });
}}
```
(Requires `VideoHistory` to pass the project alongside the URL — small additive change.)

### Fix 2 — Character prompt icon directly on the reference card

In `ChatPromptBar.tsx`:

**2.A** Add a `onPromptClick?: () => void` and `hasPrompt?: boolean` prop to `ReferenceUploadCard`. When provided AND `file` exists, render a small floating icon button on the card (top-left, opposite the X close button):
```tsx
{file && previewUrl && onPromptClick && (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onPromptClick(); }}
    className="absolute left-3 top-3 z-10 pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/30 text-cyan-50 hover:bg-cyan-500/50 backdrop-blur"
    title="Write what this character should say or do"
  >
    <Wand2 className="h-3.5 w-3.5" />
    {hasPrompt && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan-300" />}
  </button>
)}
```

**2.B** Wire it on the Character reference card only (line 399):
```tsx
<ReferenceUploadCard
  label="Character reference"
  ...
  onPromptClick={openCharacterDialog}
  hasPrompt={!!characterPrompt}
/>
```

**2.C** Keep the bottom-row "Character" button for discoverability, but the inline icon becomes the primary entry point (matches user mental model from the screenshot).

## Files to be edited
- `src/components/ad-director/ChatPromptBar.tsx` — add `onPromptClick`/`hasPrompt` props to `ReferenceUploadCard`, render inline pencil icon on character card
- `src/components/ad-director/ProVideoEditor.tsx` — smarter `selectedSceneIndex` init + smarter `videoSrc` fallback
- `src/components/ad-director/AdDirectorContent.tsx` — hydrate full project state on `onSelect` from history
- `src/components/ad-director/VideoHistory.tsx` — pass full `project` object in `onSelect` callback (additive parameter)

## What stays untouched
- Generation pipeline, Wan 2.6, edge functions
- Export/stitch logic
- DB / RLS
- Editor undo/redo, timeline, audio mixing
- UI language: English (per memory rule)

## Outcome
1. ✅ Entering the editor (after generation OR after clicking a saved project) always shows a playable video — either the stitched final or the first completed scene
2. ✅ A clear pencil/prompt icon appears directly on the Character reference card after upload
3. ✅ Click that icon → opens the existing CharacterPromptDialog → write direction → it's saved and added to the prompt
4. ✅ Existing bottom-row "Character" button preserved for discoverability
5. ✅ No changes to playback, export, or generation logic

