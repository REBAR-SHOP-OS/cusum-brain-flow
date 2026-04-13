

# Simplify UI: Prompt Bar + Recent Projects

## Goal
Make the ChatPromptBar and Recent Projects sections cleaner and flatter — remove heavy glassmorphism, reduce visual noise, use minimal borders and subtle shadows.

## Changes

### 1. `src/components/ad-director/ChatPromptBar.tsx`
- Remove the heavy `rounded-[28px] border border-white/15 bg-black/45 shadow-[0_24px_80px...]` wrapper — replace with a simple `rounded-2xl border border-white/10 bg-white/[0.03]`
- Remove the "IDEA TO POST-READY CUT" badge pill
- Remove the border-b divider between header and textarea — merge into one clean section
- Simplify the header text: keep title, remove the long description paragraph
- Reduce textarea padding, use a cleaner placeholder
- Simplify the bottom toolbar pills: remove chevron decorations, use flat minimal style
- Clean up the "Draft with AI" / "Create video" button row — less decorative, more functional

### 2. `src/components/ad-director/AdDirectorContent.tsx` (lines 554-578)
- Prompt bar wrapper (line 554): change `rounded-[32px] border border-white/12 bg-black/55 shadow-[0_40px_120px...]` to `rounded-2xl border border-white/8 bg-white/[0.02]`
- Recent Projects wrapper (line 562): same simplification — `rounded-2xl border border-white/8 bg-white/[0.02]`
- Remove uppercase tracking on "RECENT PROJECTS" label — use normal case
- Simplify heading text size

### Summary of style direction
- Borders: `border-white/8` instead of `border-white/12` or `border-white/15`
- Backgrounds: `bg-white/[0.02]` or `bg-white/[0.03]` — barely visible
- Rounded: `rounded-2xl` instead of `rounded-[28px]` / `rounded-[32px]`
- Shadows: remove heavy shadows entirely
- Text: reduce uppercase tracking labels, use normal font weights
- No removed functionality — all buttons and controls stay

