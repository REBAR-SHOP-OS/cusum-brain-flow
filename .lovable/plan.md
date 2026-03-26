

# Background Video Generation for Ad Director

## Problem
The entire Ad Director pipeline (analyze → generate scenes → stitch) runs inside `AdDirectorContent` React state. When the user navigates away, the component unmounts — all state setters become no-ops, progress is lost, and the generation silently dies. The user must stay on the page for potentially 5–10 minutes.

## Solution
Create a **singleton service** (`BackgroundAdDirectorService`) — similar to the existing `BackgroundAgentService` pattern — that holds pipeline state outside React and survives navigation.

## Architecture

```text
┌──────────────────────┐
│  AdDirectorContent   │  ← subscribes on mount, unsubscribes on unmount
│  (React component)   │     reads state from singleton, renders UI
└──────────┬───────────┘
           │ subscribe / unsubscribe
┌──────────▼───────────┐
│ BackgroundAdDirector  │  ← singleton, survives navigation
│      Service          │     holds: flowState, clips, progress, storyboard
│                       │     runs: the full async pipeline
│                       │     notifies: listeners on every state change
└───────────────────────┘
```

## Changes

### 1. New: `src/lib/backgroundAdDirectorService.ts`
- Singleton class holding all pipeline state: `flowState`, `clips`, `storyboard`, `segments`, `continuity`, `progressValue`, `statusText`, `finalVideoUrl`, `userPrompt`
- `startPipeline(...)` method — moves the entire `handleSubmit` logic from the component into the service
- `subscribe(cb)` / `unsubscribe()` — component registers a listener; every state change calls `cb(state)` so React re-renders
- `getState()` — returns current snapshot (for initial hydration on mount)
- `cancel()` — sets abort flag
- `reset()` — clears state for a new project
- State changes use an internal `setState()` that updates the singleton's state object AND notifies the listener

### 2. Refactor: `src/components/ad-director/AdDirectorContent.tsx`
- Remove all pipeline state (`flowState`, `clips`, `storyboard`, etc.) from `useState`
- On mount: call `service.subscribe(setState)` and hydrate from `service.getState()`
- On unmount: call `service.unsubscribe()`
- `handleSubmit` → calls `service.startPipeline(...)` instead of running inline
- `handleCancel` → calls `service.cancel()`
- All rendering logic remains the same, just reads from the subscribed state
- Edge function calls, polling, stitching — all moved to the service

### 3. No database changes needed
The existing `ad_project_history` auto-save already persists project data. The singleton just keeps in-memory state alive during navigation.

## Files Changed

| File | Change |
|---|---|
| `src/lib/backgroundAdDirectorService.ts` | New — singleton service holding pipeline state + execution |
| `src/components/ad-director/AdDirectorContent.tsx` | Refactor to subscribe to singleton instead of local state |

## Behavior
- User starts generation → navigates to Dashboard → comes back → sees current progress continuing
- Toast notification when generation completes while user is away
- Cancel still works from the UI when the component is mounted

