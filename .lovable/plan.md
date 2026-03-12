

# Add Visual Theme Tags to Image Generator

## What
Add a row of selectable theme chips (with check icons) between the prompt description and the suggestions area. When selected, these themes are appended to the prompt sent to the edge function, guiding the AI to include those elements in the generated image.

## Themes
| Icon | Label (EN) | Prompt keyword |
|------|-----------|----------------|
| Bird | Bird | "birds in the sky" |
| Building2 | Building | "building structure" |
| HardHat | Construction Projects | "construction project site" |
| Landmark | City | "urban cityscape" |
| TreePine | Nature | "natural landscape" |
| Users | Workers | "construction workers at work" |
| Bot | AI & Construction | "AI technology in construction" |
| Package | Our Products | "rebar stirrups, ties, and accessories" |

## Changes

### `src/components/social/ImageGeneratorDialog.tsx`
1. Add a `selectedThemes` state (`Set<string>`)
2. Define a `VISUAL_THEMES` array with `{ id, label, icon, promptTag }` objects
3. Insert a new section between the prompt textarea hint text (line 206) and the suggestions section (line 209):
   - Label: "Visual themes"
   - Render chips as toggle buttons with the icon + label + a `CheckCircle2` when selected
   - Clicking toggles the theme in/out of the set
4. In `handleGenerate`, build the final prompt by appending selected theme keywords:
   ```
   const themeString = selectedThemes joined as comma-separated promptTags
   finalPrompt = `${prompt.trim()}. Include: ${themeString}`
   ```
5. Reset `selectedThemes` in `handleClose` and `handleReset`

### No backend changes needed
The themes are injected into the user prompt string before it reaches the edge function, which already has the Pixel Agent photorealistic rules and brand context logic.

