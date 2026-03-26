

# Add Per-Scene Custom Prompt Regeneration Input

## Problem
Users cannot write a custom prompt to regenerate a specific scene card. Currently regeneration reuses the original scene prompt — there's no way to customize it per-scene from the result view.

## Changes

### `src/components/ad-director/AdDirectorContent.tsx`

**1. Add state for per-scene prompts**
- Add `scenePrompts` state: `Record<string, string>` mapping sceneId → user prompt text

**2. Modify `handleRegenerateScene` to accept optional custom prompt**
- Change signature to `(sceneId: string, customPrompt?: string)`
- If `customPrompt` is provided, use it instead of `scene.prompt` for the `motionPrompt`

**3. Add prompt input + regenerate button below each scene card** (lines 355-401)
- Below the label overlay div, outside the video card but inside the map wrapper, add:
  - A small text input for the custom prompt (placeholder: "Custom prompt...")
  - A small regenerate button (⟳ icon) that calls `handleRegenerateScene(clip.sceneId, scenePrompts[clip.sceneId])`
- Wrap each card + input in a flex-col container
- Stop click propagation on the input to prevent selecting the video

```tsx
<div key={clip.sceneId} className="flex-shrink-0 w-[280px] space-y-1.5">
  {/* Existing card div */}
  <div className="relative rounded-xl border overflow-hidden cursor-pointer ...">
    ...existing card content...
  </div>
  {/* New: prompt input + regenerate */}
  <div className="flex gap-1">
    <Input
      value={scenePrompts[clip.sceneId] || ""}
      onChange={e => setScenePrompts(p => ({...p, [clip.sceneId]: e.target.value}))}
      placeholder="Custom prompt..."
      className="h-7 text-xs flex-1"
      onClick={e => e.stopPropagation()}
    />
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0"
      disabled={clip.status === "generating"}
      onClick={() => handleRegenerateScene(clip.sceneId, scenePrompts[clip.sceneId])}
    >
      <RefreshCw className="w-3.5 h-3.5" />
    </Button>
  </div>
</div>
```

| File | Change |
|---|---|
| `src/components/ad-director/AdDirectorContent.tsx` | Add `scenePrompts` state, update `handleRegenerateScene` to accept custom prompt, add input+button below each scene card |

