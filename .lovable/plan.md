

# Fix AccessEditorPopover to Open Inline Instead of Floating

## Problem
The pencil icon in "Items" (and Agents/Automations) opens an `AccessEditorPopover` as a floating absolute-positioned dropdown (`absolute right-0 top-full z-[100002]`). The user wants this to open **inline within the card** — expanding in place rather than floating on top.

## Change

### 1. `src/components/vizzy/VizzyBrainPanel.tsx` — `AccessEditorPopover` component

**Current**: Uses `absolute right-0 top-full mt-1 z-[100002]` positioning — floats over content.

**New**: Change to a static inline layout:
- Remove `absolute right-0 top-full mt-1 z-[100002]`
- Use `border-t border-border bg-muted/20 p-3 space-y-2` — renders as an inline expandable section within the card
- Keep all checkbox logic, save/cancel buttons identical
- The editor panel expands the card naturally when opened

This is a single CSS class change on one `div` element. No logic changes needed.

| File | Change |
|------|--------|
| `VizzyBrainPanel.tsx` | Change `AccessEditorPopover` wrapper from absolute positioning to inline block |

