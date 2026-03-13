

# Ensure Floating Buttons Always Draggable (Above All Overlays)

## Problem
The two floating icons (Vizzy chat button and Camera feedback button) get blocked by drawers, modals, and overlays because their z-index is lower or equal to those overlays. Users cannot drag them when a drawer/modal is open.

## Root Cause
- **FloatingVizzyButton**: uses `z-50` (equivalent to `z-index: 50`) — same as most modals/drawers
- **ScreenshotFeedbackButton**: uses `z-[9999]` — already high enough
- **FloatingMicButton**: uses `z-[9999]` — already high enough

The Vizzy button at `z-50` gets trapped behind Radix dialogs, drawers, and overlays that also use `z-50`.

## Changes

### 1. `src/components/vizzy/FloatingVizzyButton.tsx`
- Change the wrapper `div` from `z-50` to `z-[9999]` so it always stays above all overlays, matching the camera button's z-index

### 2. `src/components/feedback/ScreenshotFeedbackButton.tsx`
- Already at `z-[9999]` — no change needed

### 3. `src/components/feedback/FloatingMicButton.tsx`
- Already at `z-[9999]` — no change needed

### Summary
Single-line change: `z-50` → `z-[9999]` on the FloatingVizzyButton wrapper div (line 81).

