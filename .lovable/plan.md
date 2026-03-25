

## Improve Chat Background Themes: Bolder Colors + Dark/Light Mode Support

### Problem
1. Current background colors are too washed out (lightness 80-90%, saturation 30-40%)
2. All themes hardcode `color: DARK_TEXT` — they only work in light mode. In dark mode, the light pastel backgrounds clash and text becomes unreadable.

### Solution
Change the `ThemeOption` interface to support separate `lightStyle` and `darkStyle` properties. Each theme gets:
- **Light mode**: Bolder, more saturated gradients (lightness ~65-75%, saturation ~50-70%) with dark text
- **Dark mode**: Deep, rich gradients (lightness ~15-25%, saturation ~40-60%) with light text
- The "default" theme remains empty (inherits system theme)

The `useTeamHubTheme` hook will detect the current system/app theme (via `next-themes` or `matchMedia`) and return the appropriate style.

### Changes

**File: `src/components/teamhub/BackgroundThemePicker.tsx`**

1. Update `ThemeOption` interface:
   ```typescript
   interface ThemeOption {
     id: string;
     name: string;
     preview: string;
     lightStyle: React.CSSProperties;
     darkStyle: React.CSSProperties;
   }
   ```

2. Redefine all 9 color themes with bolder values, e.g.:
   - **Sky Blue light**: `hsl(210 65% 70%)` → `hsl(220 55% 60%)` — vivid blue
   - **Sky Blue dark**: `hsl(210 50% 18%)` → `hsl(220 45% 12%)` — deep navy
   - Similar pattern for Mint, Lavender, Peach, Rose, Sand, Teal, Lilac, Cloud

3. Update `useTeamHubTheme` to detect dark mode (using `useTheme` from `next-themes`) and return the correct `style` from `lightStyle` or `darkStyle`

4. Preview swatches stay as bold gradient circles (using the light variant for the swatch preview)

**File: `src/pages/TeamHub.tsx`**
- No changes needed — it already uses `theme.style` which will now be resolved correctly by the hook

### Result
- Colors are noticeably richer and more vibrant in both modes
- In dark mode, backgrounds become deep/dark tones that keep text readable
- In light mode, backgrounds are bold pastels with dark text

