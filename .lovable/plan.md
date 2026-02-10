
# Blitz AI: ADHD-Friendly Rich Markdown Styling

## Overview
Replace the plain `ReactMarkdown` rendering in the Blitz AI sheet with the existing `RichMarkdown` component, which already provides colored status badges, icons, styled tables, and visual hierarchy perfect for ADHD-friendly scanning.

## What Changes

### Single File: `src/components/pipeline/PipelineAISheet.tsx`

1. **Swap renderer** -- Replace `ReactMarkdown` + inline prose styles with the `RichMarkdown` component (already built at `src/components/chat/RichMarkdown.tsx`)
2. **Remove unused imports** -- Drop `ReactMarkdown` and `remarkGfm` imports since `RichMarkdown` handles those internally
3. **Keep message bubble styling** -- The outer bubble container stays the same, only the inner content renderer changes

### What `RichMarkdown` Already Provides
- Color-coded status badges with icons (green for "Active/Done", amber for "Warning/Pending", red for "Critical/Overdue")
- Bold text auto-highlighted in primary color
- Styled tables with hover effects and status-aware cell coloring
- Bullet points with colored dots
- Code blocks with language labels
- Blockquotes with colored borders
- Headings with visual markers (colored bars, arrows)

This is a ~5 line surgical change: swap the import and replace the rendering block.
