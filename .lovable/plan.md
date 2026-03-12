

# AI Video Director — Premium UX Redesign

## Audit Summary

The current page is functionally complete but feels like a developer prototype. Key issues:

1. **No visual hierarchy** — Script textarea, brand settings, model routing, uploads, and CTA all compete for attention at the same level
2. **"Load Demo Script" is buried** — It's a tiny ghost button that most users will miss, yet it's the fastest path to value
3. **Script area is a raw textarea** — No structure, no guidance, no word/time count, no formatting hints
4. **Brand settings hidden behind a toggle** — Feels like an afterthought instead of an integrated part of the creative brief
5. **"Advanced: AI Model Routing" is exposed too early** — Technical friction that breaks creative flow
6. **Upload areas are empty voids** — No thumbnails, no drag states, no trust signals
7. **Step indicator is weak** — Flat pills with no progress indication or completion state
8. **Page header is generic** — No emotional hook, no value prop reinforcement
9. **CTA button blends in** — Same visual weight as everything else

---

## Proposed Layout Structure

```text
┌─────────────────────────────────────────────────────┐
│  Header: "AI Video Director" + cinematic tagline    │
│  Step Progress: ①─────②─────③  with completion dots │
├─────────────────────────────────────────────────────┤
│                                                     │
│  STEP 1: Two-column layout (lg breakpoint)          │
│                                                     │
│  ┌──────────────────────┐  ┌─────────────────────┐  │
│  │  CREATIVE BRIEF       │  │  BRAND KIT          │  │
│  │                       │  │                     │  │
│  │  Hero CTA:            │  │  Brand name, colors │  │
│  │  "Start with our      │  │  tagline, CTA       │  │
│  │   demo script" pill   │  │  Logo upload (card)  │  │
│  │                       │  │  Ref assets (card)   │  │
│  │  Script textarea      │  │                     │  │
│  │  with char/time count │  │  ┌─────────────────┐│  │
│  │                       │  │  │ AI Settings ⚙   ││  │
│  │                       │  │  │ (collapsed)      ││  │
│  │                       │  │  └─────────────────┘│  │
│  └──────────────────────┘  └─────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │  PRIMARY CTA: "Analyze Script & Build Storyboard"││
│  │  Full-width, large, gradient, with sparkle icon  ││
│  │  Subtext: "AI will segment, write prompts,       ││
│  │  and score quality automatically"                ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Changes by Component

### 1. `AdDirector.tsx` — Page Header
- Replace generic subtitle with a cinematic tagline: **"Script to cinematic video in minutes"**
- Add a subtle trust line: "Powered by multi-model AI pipeline"

### 2. `AdDirectorContent.tsx` — Step Indicator
- Replace flat button bar with a **connected step indicator** using numbered circles + connecting lines
- Show completion state (checkmark) for completed steps
- Add step descriptions below labels (e.g., "Script & Assets" → "Write or paste your ad script")

### 3. `ScriptInput.tsx` — Full Redesign (heaviest change)

**Current structure** (vertical stack, everything visible):
Script → Brand toggle → Model routing → Logo upload → Asset upload → Analyze button

**New structure** (two-column, guided):

**Left column — "Creative Brief"**:
- **Demo script pill**: Prominent bordered card at top: "Quick start: Load our 30s industrial ad demo" with a single click. Not a ghost button — a visually distinct callout card with a play icon
- **Script textarea**: Same textarea but with:
  - Character count badge (bottom-right)
  - Estimated duration badge: "~30s" calculated from script length
  - Placeholder improved: "Paste your 30-second ad script here, or load the demo above to see how it works..."
- Remove brand settings, logo, assets, and model routing from this column

**Right column — "Brand Kit"**:
- **Brand identity section**: Always visible (not behind a toggle). Show name, tagline, CTA, target audience, website in a compact card with subtle labels
- **Color pickers**: Inline with brand fields, same row as brand name
- **Logo upload card**: Replace empty dashed box with a proper upload card that has an icon, title ("Brand Logo"), description ("Used for watermark and end card"), and a clear upload button. When uploaded, show the logo with a remove option
- **Reference assets card**: Same treatment — proper card with icon, title ("Reference Assets"), description ("Product photos, voiceover, music"), upload button, and file list
- **AI Model Routing**: Move to a collapsible section at the bottom of the right column, relabeled as "AI Engine Settings" with a gear icon. Default collapsed. Remove "Advanced:" prefix

**Below both columns — Primary CTA**:
- Full-width button, taller (h-14), stronger gradient
- Icon: Sparkles
- Text: **"Analyze & Build Storyboard"**
- Subtext below button: "AI segments your script, writes cinematic prompts, and scores quality — ~60 seconds"

### 4. Upload Empty States
- Replace dashed borders with solid subtle borders + a centered icon + title + description
- Add hover state: border glows primary color, icon scales up slightly
- When files are present: show file chips with type icons (image/video/audio)

### 5. `StoryboardTimeline.tsx` — Minor Polish
- Add scene count and total duration in header
- "Generate All Scenes" button: keep cost confirmation dialog, no changes needed

### 6. `FinalPreview.tsx` — Minor Polish
- No structural changes needed — already functional

### 7. Visual Polish (applied across all components)
- Increase border-radius on main cards from `rounded-xl` to `rounded-2xl`
- Add subtle `backdrop-blur-xl` to card backgrounds
- Use `ring-1 ring-white/5` for depth on dark backgrounds
- Step transitions: add `animate-in fade-in slide-in-from-bottom-4` when switching steps

---

## Revised Microcopy

| Element | Current | Proposed |
|---|---|---|
| Page subtitle | "Intelligent 30-second B2B ad production — from script to cinematic video" | "Script to cinematic video in minutes" |
| Demo script button | "Load Demo Script" (ghost btn) | "Quick start — Load demo script" (card) |
| Script placeholder | "Paste your 30-second ad script here..." | "Paste your ad script here, or load the demo above to get started..." |
| Brand toggle | "Show Brand Settings" | Always visible as "Brand Kit" card |
| Model routing | "Advanced: AI Model Routing" | "AI Engine" (collapsed, gear icon) |
| Logo upload | "Upload logo for watermark & end card" | "Brand Logo · Used in watermark & end card" |
| Asset upload | "Upload product images, site photos..." | "Reference Assets · Photos, drawings, voiceover, or music" |
| Analyze CTA | "Analyze & Create Storyboard" | "Analyze & Build Storyboard" |
| CTA subtext | (none) | "AI will segment, write prompts, and score quality · ~60s" |

---

## Files Modified

1. **`src/pages/AdDirector.tsx`** — Updated header copy
2. **`src/components/ad-director/ScriptInput.tsx`** — Full redesign: two-column layout, demo script card, always-visible brand kit, relocated uploads, better empty states, improved CTA
3. **`src/components/ad-director/AdDirectorContent.tsx`** — New step indicator with connected circles + completion states, step transition animations
4. **`src/components/ad-director/AdvancedModelSettings.tsx`** — Rename label from "Advanced: AI Model Routing" to "AI Engine", remove "Advanced:" prefix

No backend changes. No new dependencies. Pure UI/UX refactor using existing Tailwind classes and Radix primitives.

