

# Remove Ad Director Hero Section

## What's being removed
The entire hero area circled in red: the "AI VIDEO DIRECTOR" badge, headline ("Modernize your ad idea..."), description paragraph, feature pills (Prompt to storyboard, Reference-guided scenes, Editable final composition), the Workflow card with 3 steps, and Quick Start Ideas section.

## What stays
- The prompt bar (ChatPromptBar)
- Recent projects (VideoHistory)
- Background video

## Changes

### `src/components/ad-director/AdDirectorContent.tsx`
- Remove the `QUICK_START_IDEAS` array (lines 28-47)
- Remove the `HERO_POINTS` array (lines 49-53)
- Remove the `handleQuickStart` function reference
- Remove the entire `grid xl:grid-cols-[1.2fr_0.8fr]` block (lines 475-551) containing the hero card and workflow card
- Keep the prompt bar wrapper (line 554) and recent projects wrapper (line 562) intact
- Remove unused imports (`Film`, `Sparkles`, `Clapperboard`, `Wand2`, `Layers3`)

### `src/components/ad-director/ChatPromptBar.tsx`
- Remove `starterPrompt` / `starterPromptSeed` props since quick-start is gone (if they were only used for that)

Result: The idle state shows only the clean prompt bar + recent projects on the background video.

