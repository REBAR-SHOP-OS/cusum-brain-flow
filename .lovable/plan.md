
## Audit Findings (why it is still low quality + crashing)

1. Current capture logic is still **heuristic-based** (`isHeavyRoute = elementCount > 3000`).
2. On `/pipeline`, crash can still happen even when element count is under threshold because:
   - the board is very wide (`PipelineBoard` uses `min-w-max` with many fixed-width columns),
   - and if heavy detection misses, capture can still use large `scrollWidth/scrollHeight`.
3. Low quality is currently expected on heavy pages because scale drops to `0.75` or `0.5`.
4. Your requirement is explicit: on pipeline, capture **only what is visible on screen**.  
   The current logic still does this only conditionally, not route-enforced.

## Implementation Plan (step-by-step)

### 1) Introduce explicit route-based viewport mode in screenshot capture
**File:** `src/components/feedback/ScreenshotFeedbackButton.tsx`

- Add route detection near the top of `capture()`:
  - `const path = window.location.pathname`
  - `const isPipelineRoute = path === "/pipeline" || path.startsWith("/pipeline/")`
- Create a single mode flag:
  - `const forceViewportOnly = isOverlay || isPipelineRoute || isHeavyRoute`

Why: this guarantees `/pipeline` always uses viewport-only capture regardless of DOM count.

---

### 2) Skip all overflow expansion when viewport-only mode is active
**Same file**

- Update expansion gate from:
  - `if (!isOverlay && !isHeavyRoute && target instanceof HTMLElement)`
- To:
  - `if (!forceViewportOnly && target instanceof HTMLElement)`

Why: overflow expansion is what can balloon render size and trigger memory crashes.

---

### 3) Force viewport dimensions whenever viewport-only mode is active
**Same file**

- Keep full-page capture behavior for non-viewport routes.
- For viewport-only mode, always use:
  - `captureWidth = window.innerWidth`
  - `captureHeight = window.innerHeight`

Why: canvas stays bounded to visible screen area.

---

### 4) Improve quality specifically for viewport-only captures
**Same file**

- Add a dedicated scale branch:
  - `viewportScale = Math.min(window.devicePixelRatio || 1, 1.5)` (or 2 if testing is stable)
- Use:
  - if `forceViewportOnly` → `scale: viewportScale`
  - else keep existing heavy/full-page tiered scale logic

Why: this restores readability while still keeping memory bounded because viewport dimensions are fixed.

---

### 5) Keep crash-safe fallback path intact
**Same file**

- Preserve existing retry path (`captureOnce(false)` then `captureOnce(true)`).
- Preserve timeout guard.
- Optionally use slightly shorter timeout for viewport-only mode (faster fail/retry), but keep current timeout if stability is preferred.

Why: this is already good defensive behavior and should remain.

---

### 6) (Secondary but important) clean annotation dialog warnings
**File:** `src/components/feedback/AnnotationOverlay.tsx`

- Fix Radix dialog accessibility warning by adding a `DialogDescription` (or `aria-describedby={undefined}` intentionally).
- Investigate and resolve `Function components cannot be given refs` warning originating around `Dialog` usage in `AnnotationOverlay`.

Why: not the root crash cause, but these warnings add noise during debugging and can mask real errors.

## Technical Details (for dev review)

```text
Current:
- Mode decision tied mainly to element count threshold.
- Quality reduced on heavy pages by design (0.75/0.5 scale).
- Pipeline can still slip into non-viewport path if threshold not met.

Planned:
- Route-enforced mode for /pipeline:
  forceViewportOnly = isOverlay || isPipelineRoute || isHeavyRoute
- No overflow expansion in forceViewportOnly mode.
- Canvas dimensions fixed to viewport in forceViewportOnly mode.
- Higher render scale for viewport captures only (quality without huge memory).
```

## Validation Checklist (must pass)

1. On `/pipeline`, click screenshot:
   - captures only visible region (not full scrollable board),
   - no tab crash,
   - text is readable.
2. Horizontally scroll pipeline board, then screenshot:
   - captured image matches what is currently visible.
3. On non-pipeline lighter pages:
   - full-page (scroll) capture still works as before.
4. On very heavy non-pipeline pages:
   - no crash, fallback behavior still works.
5. Open annotation dialog:
   - no new console errors; accessibility warning resolved.
