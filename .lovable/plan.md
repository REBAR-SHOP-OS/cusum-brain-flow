

# Add Logo Upload to AI Story/Image Generator Dialog

## Problem
The "Logo" visual theme button is disabled when no logo exists in Brand Kit, and there's no way to upload a logo directly from this dialog. Users must go to Brand Kit settings first.

## Solution
1. **Make Logo theme always interactive** — remove the disabled state; if no logo is uploaded, clicking it opens/highlights the upload section below.
2. **Add a Logo Upload section** below the Visual Themes area, allowing users to upload their company logo directly within the dialog. This logo will be saved to the `brand_kit` table and used by the AI during image generation.

### File: `src/components/social/ImageGeneratorDialog.tsx`

**Changes:**
- Remove `logoDisabled` logic so the Logo chip is always clickable
- When Logo theme is selected and no logo exists, auto-scroll to/highlight the upload section
- Add a new "Company Logo" section between Visual Themes and Suggestions:
  - Shows current logo preview if one exists (from `brandKit.logo_url`)
  - Upload button to select a new logo file
  - Uploads to `brand-assets` storage bucket (same pattern as `BrandKitSidePanel`)
  - Updates `brand_kit` via `useBrandKit().saveBrandKit` mutation
  - Delete/remove button to clear the logo
- Auto-select the "logo" theme when a logo is uploaded successfully

