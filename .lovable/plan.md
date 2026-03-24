

## Add Background Theme Picker for Team Hub

### What It Does
Adds a small paintbrush/palette icon button in the Team Hub header area. Clicking it opens a popover with preset background themes (colors, gradients, patterns). The user's choice is saved to `localStorage` and applied to the chat area background.

### Changes

**File**: `src/components/teamhub/BackgroundThemePicker.tsx` (NEW)
- A popover component with 8-10 preset themes:
  - Default dark, Midnight blue, Deep purple, Ocean teal, Forest green, Warm sunset gradient, Starry pattern, Geometric subtle pattern, etc.
- Each theme is a small circular swatch the user can click
- Selected theme is stored in `localStorage` under key `teamhub_bg_theme`
- Exports a `useTeamHubTheme()` hook that reads the stored theme and returns CSS classes/styles

**File**: `src/pages/TeamHub.tsx`
- Import `useTeamHubTheme` and `BackgroundThemePicker`
- Apply the selected theme's CSS to the main chat container (`div.bg-background` at line 242)
- Render `BackgroundThemePicker` icon button in the top area (passed to `MessageThread` or rendered alongside it)

**File**: `src/components/teamhub/MessageThread.tsx`
- Add optional `headerExtra?: ReactNode` prop
- Render `headerExtra` in the channel header bar (next to the video call button) so the theme picker icon appears in the top-right of the chat

### Preset Themes
| Name | Style |
|---|---|
| Default | Current dark background |
| Midnight | `bg-slate-950` |
| Ocean | `bg-gradient-to-b from-cyan-950 to-slate-900` |
| Purple Haze | `bg-gradient-to-b from-purple-950 to-slate-900` |
| Forest | `bg-gradient-to-b from-emerald-950 to-slate-900` |
| Warm | `bg-gradient-to-b from-amber-950 to-slate-900` |
| Geometric | CSS pattern overlay |
| Minimal Light | Light gray theme |

### Summary
| File | Change |
|---|---|
| `src/components/teamhub/BackgroundThemePicker.tsx` | NEW — theme picker popover + hook |
| `src/pages/TeamHub.tsx` | Apply selected theme to chat area |
| `src/components/teamhub/MessageThread.tsx` | Add `headerExtra` prop for picker icon |

