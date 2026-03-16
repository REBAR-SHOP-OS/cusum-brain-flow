

# Make Logo Theme Toggleable

## Current Problem
The Logo chip is forced always-on and disabled (non-toggleable) when `brandKit.logo_url` exists. The user wants it to be a normal selectable chip — when selected, the logo is applied to images; when not, no logo.

## Changes — Single File

**`src/components/social/ImageGeneratorDialog.tsx`**

1. **Remove auto-force logic** (lines 69-80): Delete `logoAutoApplied` variable and the `useEffect` that forces "logo" into `selectedThemes`
2. **Make chip toggleable**: Remove the `disabled` condition and `cursor-default` styling for the logo chip (line 278-284). It becomes a normal toggle like all other themes.
3. **Conditional logo overlay** (lines 159-167): Change from `if (brandKit?.logo_url)` to `if (brandKit?.logo_url && selectedThemes.has("logo"))` — only apply logo when user has selected the Logo theme
4. **Reset/close**: Update `handleReset` and `handleClose` to clear all themes normally (no special logo preservation)
5. **Branded badge** (line 389): Also make conditional on `selectedThemes.has("logo")`

No logic changes to generation, no backend changes, no database changes.

