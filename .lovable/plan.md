

# Fix Pixel Agent Logo Error Blocking Image Generation

## Problem
The Pixel agent requires a company logo file at `social-images/brand/company-logo.png` in storage. When this file doesn't exist (HTTP 400), the agent aborts entirely and shows the error: "لوگوی رسمی شرکت در مخزن برند پیدا نشد".

## Solution
Make the logo **optional** instead of mandatory. If the logo file is missing, proceed with image generation without it — don't block the entire flow.

## Changes

### File: `supabase/functions/ai-agent/index.ts`

1. **`resolveLogoUrl()` (lines 192-211)**: Change from throwing errors to returning `null` when logo is not found. Return type becomes `Promise<string | null>`.

2. **Logo resolution call site (lines 519-528)**: Instead of try/catch that aborts on error, simply call the function and accept `null` — no logo means generate without it. Remove the early-return error response.

3. **`generatePixelImage()` already handles `logoUrl` being undefined** (line 247: `if (attempt.useLogo && logoUrl)`) — so passing `null`/`undefined` will naturally skip logo attachment. No changes needed in this function.

This is a minimal, targeted fix: 2 small edits in one file, no database changes.

