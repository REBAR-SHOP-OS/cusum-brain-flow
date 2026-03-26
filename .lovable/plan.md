

# Simplify & Widen the Editor View

## Problem
The Pro Editor (editing mode) is constrained to `max-w-4xl` from the parent page, making it narrow. The UI has too many icons/tabs and the name says "Pro Editor" but should be called "Edit". The overall look needs to be simpler and cleaner.

## Changes

### 1. Widen the page when in editing mode — `AdDirector.tsx`
- Remove `max-w-4xl` constraint when the editor is active
- The page wrapper should go full-width (edge-to-edge) when `flowState === "editing"`
- Pass `flowState` info up or conditionally render the editor outside the constrained wrapper

### 2. Widen editing wrapper — `AdDirectorContent.tsx`
- When `flowState === "editing"`, return the `ProVideoEditor` without the `max-w-4xl` parent constraint — render it full-width with minimal padding (e.g. `px-2`)

### 3. Simplify the Pro Editor UI — `ProVideoEditor.tsx`
- **Rename**: Change "Pro Editor" badge to "Edit" or remove it entirely
- **Simplify top bar**: Reduce icon clutter — keep only essential actions (Back, Undo/Redo, Auto Voiceover, Export). Remove Reset button, reduce spacing
- **Simplify sidebar tabs**: Keep icons only (no labels), make sidebar narrower default (e.g. `w-52`)
- **Reduce visual noise**: Simplify borders, reduce backdrop-blur effects, use cleaner button styles
- **Simplify playback controls**: Keep essential controls only (play/pause, skip, scrub, volume, fullscreen) — already clean, just make icons slightly larger for readability
- **Timeline**: Keep as-is (already functional)

### 4. Full-width layout — `AdDirector.tsx`
- Detect editing state and conditionally remove `max-w-4xl` + reduce padding
- The editor should use nearly the full viewport width

## Files Changed

| File | Change |
|---|---|
| `src/pages/AdDirector.tsx` | Conditionally go full-width when editing mode is active |
| `src/components/ad-director/AdDirectorContent.tsx` | Pass editing state up; render editor full-width |
| `src/components/ad-director/ProVideoEditor.tsx` | Rename to "Edit", simplify top bar, cleaner sidebar, reduce visual noise |

