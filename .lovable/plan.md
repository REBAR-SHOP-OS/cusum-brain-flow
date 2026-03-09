

# Plan: Auto-detect text direction (RTL/LTR) based on content

## Problem
Currently, text direction is determined by the user's language preference (`myLang`). The user wants direction to be based on the **actual text content** — Persian/Arabic text right-aligned, English text left-aligned.

## Approach
Create a shared `detectTextDirection` utility that inspects actual characters (like the existing `isRTL` in RichMarkdown.tsx), then use it in both chat components instead of checking language codes.

## Changes

### 1. New utility: `src/utils/textDirection.ts`
- Export `detectRtl(text: string): boolean` — checks first 100 non-markup characters for RTL Unicode range
- Reusable across all chat surfaces

### 2. `src/components/teamhub/MessageThread.tsx`
- **Message bubbles** (line ~454-458): Replace `isRtl(displayLang)` with `detectRtl(displayText)` so direction follows actual content
- **Input textarea** (line ~573): Replace `isRtl(myLang)` with `dir="auto"` so the browser auto-detects as user types

### 3. `src/components/chat/DockChatBox.tsx`
- **Message bubbles** (line ~429-438): Add `dir={detectRtl(cleanText) ? "rtl" : "ltr"}` and corresponding text alignment
- **Input field**: Add `dir="auto"`

No database changes. No breaking changes. Two files patched, one small utility created.

