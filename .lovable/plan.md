

# Fix Agent/Automation Edit Popover Not Visible

## Root Cause
The parent container (line 1329) has `overflow-hidden` CSS class, which clips the `AccessEditorPopover` since it uses `position: absolute` with `top: full` (rendering below the header). The popover is rendered but invisible because it's cut off.

## Fix

### `src/components/vizzy/VizzyBrainPanel.tsx`

Two changes:

1. **Remove `overflow-hidden` from the Agents section wrapper** (line 1329) — change to just `overflow-visible` or remove the overflow class entirely. The `rounded-xl` and `border` will still contain the visual styling.

2. **Same fix for the Automations section wrapper** — ensure it also doesn't clip its popover.

Alternatively, a cleaner approach: move the `AccessEditorPopover` rendering **outside** the `overflow-hidden` container, or change the popover to use a portal (but the simplest fix is removing `overflow-hidden`).

| Line | Before | After |
|------|--------|-------|
| ~1329 | `rounded-xl border border-border bg-card overflow-hidden relative` | `rounded-xl border border-border bg-card relative` |

Single class removal, one file. The popover will then appear correctly when the pencil icon is clicked.

