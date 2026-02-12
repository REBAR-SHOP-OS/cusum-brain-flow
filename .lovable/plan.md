

# Fix Low-Contrast Font Colors on Inbox Kanban Cards

## Problem
In dark mode, the text on Kanban email cards (subject, preview, footer, timestamps) is too dim and hard to read. The `text-muted-foreground` CSS variable is set to `hsl(215 20% 55%)` in dark mode, which lacks sufficient contrast against dark card backgrounds.

## Solution
Bump the dark-mode `--muted-foreground` lightness from 55% to 65% in `src/index.css`. This improves readability across the entire app in dark mode without changing light mode.

## File Change

**`src/index.css`** (dark theme section):
- Change `--muted-foreground: 215 20% 55%` to `--muted-foreground: 215 20% 65%`

This single change fixes contrast for all `text-muted-foreground` usage across the inbox cards (preview text, timestamps, footer email addresses) and every other component using this token in dark mode.
