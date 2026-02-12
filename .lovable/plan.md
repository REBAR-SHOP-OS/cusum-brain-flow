

# Fix Email Body Colors for Dark Mode

## Problem
The email body cards in the inbox are rendered with forced `bg-white text-zinc-900` / `text-zinc-800`, creating a jarring bright white block against the dark mode UI. Icons, links, and text within these cards clash with the rest of the interface.

## Solution
Switch the email body containers from hardcoded white/light styles to dark-mode-compatible theme colors across both viewer components.

## File Changes

### 1. `src/components/inbox/InboxEmailThread.tsx` (line ~315)
Replace the email body container classes:
- `bg-white text-zinc-900` → `bg-card text-card-foreground`
- `[&_a]:text-blue-600` → `[&_a]:text-primary [&_a]:underline`

### 2. `src/components/inbox/InboxEmailViewer.tsx` (line ~299)
Replace the email body container classes:
- `bg-white text-zinc-800` → `bg-card text-card-foreground`
- All hardcoded `zinc-*` color references → theme-aware equivalents:
  - `[&_a]:text-cyan-600` → `[&_a]:text-primary`
  - `[&_blockquote]:text-zinc-500` → `[&_blockquote]:text-muted-foreground`
  - `[&_hr]:border-zinc-200` → `[&_hr]:border-border`
  - `[&_pre]:bg-zinc-100` / `[&_code]:bg-zinc-100` → `[&_pre]:bg-muted [&_code]:bg-muted`

This ensures the email body blends with the dark theme while remaining readable in light mode too.

