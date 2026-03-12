

# Fix Build Quantity: Generate Complete Ad Videos, Not Scene Duplicates

## Problem
"Build Quantity = 4" currently duplicates every storyboard scene 4 times (cloning scene cards into the timeline). The user expects **4 complete ad video outputs** — each an independently generated full ad — not 4 copies of each scene.

## What Changes

### 1. `src/components/ad-director/AdDirectorContent.tsx` — Rewrite `handleGenerateAll`
- **Remove** the storyboard/clip duplication logic (lines 556-582) that clones scene entries with `-v2`, `-v3` suffixes
- **Instead**, run the entire generation pipeline `buildQty` times sequentially (or with light parallelism), producing `buildQty` independent sets of clips
- Store results as separate "builds" — e.g. `Build 1`, `Build 2`, etc. — each containing clips for all scenes
- Add a `builds` state array: `{ buildIndex: number, clips: ClipOutput[] }[]`
- After all builds finish, the user can preview/compare/export any build

### 2. `src/components/ad-director/AdDirectorContent.tsx` — Build selector UI
- Add a simple tab bar or dropdown in the Storyboard/Preview step: "Build 1 | Build 2 | Build 3 | Build 4"
- The active build determines which clip set is displayed in the timeline and preview
- Export uses the selected build's clips

### 3. `src/components/ad-director/StoryboardTimeline.tsx` — No scene duplication
- Timeline stays clean — always shows the original storyboard scenes
- Clips shown come from the currently selected build

### 4. `src/components/ad-director/VideoParameters.tsx` — Label clarity
- Rename "Build Quantity" label to "Number of Ad Versions" so intent is clear

## Technical Flow
```text
User sets: 4 versions × 8s duration
           ↓
handleGenerateAll loops 4 times:
  Build 1: generate scene-1 → scene-N (8s each)
  Build 2: generate scene-1 → scene-N (8s each)
  Build 3: ...
  Build 4: ...
           ↓
Each build stored in builds[] state
User tabs between builds to compare
Export uses selected build
```

### Files
- `src/components/ad-director/AdDirectorContent.tsx` — builds state, rewrite handleGenerateAll, build selector
- `src/components/ad-director/StoryboardTimeline.tsx` — accept clips from selected build
- `src/components/ad-director/VideoParameters.tsx` — rename label

