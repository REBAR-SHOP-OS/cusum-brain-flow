

# Vizzy Brain Panel — UI Enlargement & Readability

## Current State
The panel is a modal dialog with:
- `max-w-2xl` (~672px) width, `max-h-[85vh]` height (line 989)
- Text sizes mostly `text-sm` / `text-xs`
- Compact padding throughout

## Changes

### File: `src/components/vizzy/VizzyBrainPanel.tsx`

**1. Enlarge modal container** (line 989):
- Change `max-w-2xl` → `max-w-5xl` (wider)
- Change `max-h-[85vh]` → `max-h-[92vh]` (taller)

**2. Increase header text** (line 992–1014):
- Title `text-lg` → `text-xl`
- Entry count badge `text-xs` → `text-sm`

**3. Enlarge content area padding** (line 1057):
- `px-5 py-4` → `px-6 py-5`

**4. Increase General Report section text** (lines 948–970):
- Section header `text-sm` → `text-base`
- Accordion trigger `text-sm` → `text-base`
- Item count badge stays `text-xs` → `text-sm`

**5. Increase General Overview section text** (lines 1067–1077):
- Header `text-sm` → `text-base`

**6. Team Daily Report card text** — increase accordion item text sizes similarly

**7. Increase accordion content readability**:
- Entries inside `DateGroupedEntries` will benefit from the larger container width automatically

All changes are purely visual — no logic or data flow modifications.

| File | Change |
|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | Enlarge modal, increase font sizes and padding |

