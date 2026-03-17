
# AI Video Director — Full Module Audit & Modernization Plan

## Current State Summary

The Ad Director is a substantial 1,047-line orchestrator (`AdDirectorContent.tsx`) with a 3-step workflow (Script → Storyboard → Preview), a 744-line edge function (`ad-director-ai`), a Canva-style editor (`ProVideoEditor.tsx`, 1,371 lines), sidebar, brand kit persistence, multi-build support, and Alibaba Wan 2.6 video generation. It is functional but has accumulated technical debt and UX friction.

---

## Audit Findings

### UX Issues
1. **No onboarding or empty state** — New users land on a blank script textarea with no guidance on what the tool does or how to start.
2. **Step indicator is small and passive** — The pill-style stepper lacks progress context (e.g., "3 scenes ready") and visual momentum.
3. **No loading skeleton** — During brand kit fetch, the form shows stale defaults briefly.
4. **Script textarea has no character/word counter visible inline** — The counter exists in code but is buried.
5. **Storyboard cards are dense** — Scene cards mix editing controls, generation status, quality scores, and intelligence bars into a single cramped view.
6. **Sidebar lacks active state feedback on mobile** — The floating panel has no backdrop overlay, can overlap content.
7. **Export flow is fragile** — Browser-side stitching is the primary path; GCE assembly is a stub that always falls back.
8. **No undo/redo for prompt edits** — Users lose previous prompt versions when editing.
9. **Multi-build UX is confusing** — Version tabs appear only during generation with no explanation.

### Technical Issues
1. **1,047-line monolith** — `AdDirectorContent.tsx` handles state, API calls, polling, canvas rendering, storage uploads, and project save/load all in one component.
2. **Stale closure risk** — `generateScene` uses `storyboardRef.current` to work around stale state, indicating the callback chain is fragile.
3. **No error boundary** — A single failed render crashes the entire director.
4. **Polling is unbounded** — 120 attempts × 5s = 10 minutes of polling with no user-visible cancel button.
5. **`clips` state is mutated from multiple effects** — Auto-upload effect and generation polling both call `setClips`, risking race conditions.
6. **`as any` casts in brand kit hook** — Type safety is bypassed for the `brand_kit` table.
7. **No retry UI for failed scenes** — The "Regenerate" button exists but there is no batch retry for all failed scenes.
8. **Edge function uses hardcoded model routes** — No way to A/B test or dynamically update model preferences without redeployment.

### Dashboard Card (AutomationsSection)
The card already has improved copy and highlights from the previous update. The screenshot shows the **old** state. Current code is correct.

---

## Improvement Plan

### Phase 1 — UX Polish (5 files)

**1.1 Welcome Empty State & Quick-Start**
- File: `ScriptInput.tsx`
- Add an illustrated empty state with 3 quick-start options: "Paste a script", "Use demo script", "Describe your product (AI writes the script)"
- Show inline word count + estimated duration badge beside the textarea

**1.2 Enhanced Step Indicator**
- File: `AdDirectorContent.tsx` (extract to `StepIndicator.tsx`)
- Show contextual badges: "5 scenes" on Storyboard step, "Ready to export" on Preview
- Add animated progress line connecting steps

**1.3 Loading States**
- File: `AdDirectorContent.tsx`
- Add skeleton loader while brand kit loads
- Add shimmer placeholders for storyboard cards during analysis

**1.4 Cancel Generation**
- File: `AdDirectorContent.tsx`
- Add AbortController to polling loop
- Show "Cancel" button in the global progress bar
- Track cancelled state per clip

**1.5 Mobile Sidebar Overlay**
- File: `AdDirectorContent.tsx`
- Add backdrop overlay when floating panel is open on small screens
- Close on outside click

### Phase 2 — Code Architecture (4 files)

**2.1 Extract Generation Logic**
- Create `hooks/useAdDirectorGeneration.ts` — moves `generateScene`, `pollGeneration`, `handleGenerateAll`, `handleExport` out of the component
- Reduces `AdDirectorContent.tsx` by ~400 lines
- Eliminates stale closure issues by using proper React patterns

**2.2 Extract Analysis Pipeline**
- Create `hooks/useAdDirectorAnalysis.ts` — moves `handleAnalyze` and the multi-step analysis pipeline
- Reduces another ~200 lines

**2.3 Error Boundary**
- Create `AdDirectorErrorBoundary.tsx` wrapping the content component
- Graceful fallback with "Reload" button

**2.4 Type Safety**
- Remove `as any` casts in `useAdDirectorBrandKit.ts` by adding proper type assertions
- Add runtime validation for edge function responses

### Phase 3 — Modern Features (3 files)

**3.1 Batch Retry Failed Scenes**
- File: `StoryboardTimeline.tsx`
- Add "Retry all failed" button when any scene has `status: "failed"`
- Wire to `generateScene` for each failed clip

**3.2 Prompt History (Undo)**
- File: `AdDirectorContent.tsx` (or extracted hook)
- Store last 3 prompt versions per scene in local state
- Add undo button on `SceneCard`

**3.3 AI Script Writer**
- File: `ScriptInput.tsx` + edge function call
- "Describe your product" → AI generates a 30s ad script using the existing `ad-director-ai` edge function with a new `write-script` action
- New action in edge function: `supabase/functions/ad-director-ai/index.ts`

### Phase 4 — Dashboard Card Verification
- File: `AutomationsSection.tsx`
- Verify the card renders with current improved copy and highlights (no code changes needed — already updated)

---

## Files Touched Summary
| File | Action |
|------|--------|
| `src/components/ad-director/ScriptInput.tsx` | Enhanced empty state, AI script writer |
| `src/components/ad-director/AdDirectorContent.tsx` | Extract logic, add cancel, skeletons, error boundary wrapper |
| `src/components/ad-director/StepIndicator.tsx` | New — extracted enhanced step indicator |
| `src/hooks/useAdDirectorGeneration.ts` | New — generation + polling logic |
| `src/hooks/useAdDirectorAnalysis.ts` | New — analysis pipeline logic |
| `src/components/ad-director/AdDirectorErrorBoundary.tsx` | New — error boundary |
| `src/components/ad-director/StoryboardTimeline.tsx` | Batch retry button |
| `src/components/ad-director/SceneCard.tsx` | Prompt undo button |
| `src/hooks/useAdDirectorBrandKit.ts` | Remove `as any` casts |
| `supabase/functions/ad-director-ai/index.ts` | New `write-script` action |

No database changes required. Edge function update is backward-compatible.
