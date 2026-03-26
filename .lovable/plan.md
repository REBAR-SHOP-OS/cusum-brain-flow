

# Redesign CameraLoader — Frameless Spinning Camera with Scene Count

## Problem
The current loader has a bordered card/box. User wants: no card, just a large spinning camera icon with the number of films/scenes being generated.

## Changes

### `src/components/ad-director/CameraLoader.tsx` — Full rewrite

Replace the entire boxed viewfinder with a minimal, frameless design:
- **Large Camera icon** (lucide `Camera` or `Video`), ~20×20 (80px), spinning continuously with a glow effect
- **Pulsing ring** around the icon for extra cinematic feel
- **Status text** below the icon (e.g. "Assembling final video...")
- **Scene count badge** showing number of scenes/films being generated (e.g. "🎬 4 Scenes")
- **Progress bar** — minimal circular or linear, no box
- **Cancel button** — small, subtle
- No card, no border, no background box — content floats over the video background

### `src/components/ad-director/CameraLoader.tsx` — Props update

Add `sceneCount` prop:
```ts
interface CameraLoaderProps {
  statusText: string;
  progressValue: number;
  sceneCount?: number;
  onCancel: () => void;
}
```

### `src/components/ad-director/AdDirectorContent.tsx` — Pass scene count

Update the `<CameraLoader>` call to pass `sceneCount={storyboard.length}`:
```tsx
<CameraLoader 
  statusText={statusText} 
  progressValue={progressValue} 
  sceneCount={storyboard.length}
  onCancel={handleCancel} 
/>
```

| File | Change |
|---|---|
| `CameraLoader.tsx` | Rewrite: frameless spinning camera icon + scene count badge |
| `AdDirectorContent.tsx` | Pass `sceneCount={storyboard.length}` to CameraLoader |

