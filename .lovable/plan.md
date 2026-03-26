

# Add Product and Style Selectors to Ad Director Chat Bar

## What
Add the same product icons (Fiberglass, Stirrups, Cages, etc.) and style selectors (Realism, Construction, Cartoon, etc.) from the Pixel agent's chat input to the Ad Director's `ChatPromptBar`. The selected product and style will be injected into the video generation prompt so the AI creates videos tailored to the chosen product and visual style.

## How

### 1. Update `ChatPromptBar.tsx`
- Import the same `PRODUCT_ICONS` and `IMAGE_STYLES` arrays (and their icon components) used in `ChatInput.tsx`
- Add state for `selectedProducts` and `selectedStyles`
- Render two popover buttons ("Products" and "Style") in the bottom toolbar bar, between Duration and Send — using the same grid/icon pattern as Pixel
- Pass selected product/style keys into `onSubmit` so the parent can inject them into the AI prompt

### 2. Update `AdDirectorContent.tsx`
- Accept `selectedProducts` and `selectedStyles` from `ChatPromptBar`
- Prepend product and style context to the user prompt before sending to the pipeline (e.g., `"Product: Fiberglass, Cages. Style: Construction, Realism. [user prompt]"`)

## Files Changed

| File | Change |
|---|---|
| `src/components/ad-director/ChatPromptBar.tsx` | Add product/style popover selectors with icons, pass selections via onSubmit |
| `src/components/ad-director/AdDirectorContent.tsx` | Receive product/style from ChatPromptBar, prepend to AI prompt |

