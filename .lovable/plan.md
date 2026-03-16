

# UI Redesign: Simpler & More User-Friendly Ad Director

## Approach
Pure visual/CSS changes — no logic or feature changes. Focus on reducing visual clutter, improving spacing, and making the interface feel lighter and more intuitive.

## Changes

### 1. `src/pages/AdDirector.tsx` — Lighter Header
- Remove the heavy gradient icon box and "Powered by" badge
- Use a simple clean header with icon + text, less padding

### 2. `src/components/ad-director/AdDirectorSidebar.tsx` — Cleaner Sidebar
- Softer section labels, better spacing between groups
- Slightly larger touch targets for items
- Cleaner history items with less visual noise

### 3. `src/components/ad-director/AdDirectorContent.tsx` — Cleaner Stepper
- Simplify the step indicator: horizontal pills instead of heavy rounded buttons
- Reduce spacing and remove unnecessary rings/shadows
- Cleaner progress bar area

### 4. `src/components/ad-director/ScriptInput.tsx` — Simplified Script Panel
- Cleaner Quick Start card (less padding, simpler border)
- Simpler Reference Assets card — less nested containers
- Cleaner textarea with subtle background
- Simpler Recent Projects grid
- Lighter CTA button (less shadow, cleaner gradient)

### 5. `src/components/ad-director/VideoParameters.tsx` — Cleaner Controls
- Simpler ratio buttons with less border noise
- Better label hierarchy
- Cleaner slider area

### Files to Edit
| File | What Changes |
|------|-------------|
| `src/pages/AdDirector.tsx` | Lighter header |
| `src/components/ad-director/AdDirectorSidebar.tsx` | Cleaner sidebar styling |
| `src/components/ad-director/AdDirectorContent.tsx` | Simplified stepper & layout |
| `src/components/ad-director/ScriptInput.tsx` | Cleaner cards & CTA |
| `src/components/ad-director/VideoParameters.tsx` | Cleaner controls |

No logic, no features, no database changes — purely visual polish for better usability.

