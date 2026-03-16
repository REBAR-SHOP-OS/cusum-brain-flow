

# Add "Generate Lovable Command" to Fix Requests

## Problem
The current FIX ALL system handles stale/auth/cache errors but cannot fix actual code bugs. When a real code error is logged, you have to manually describe the problem to Lovable. The `generate-fix-prompt` edge function already exists but is only wired to the Tasks page -- not to fix requests.

## Solution
Add a one-click "Generate Lovable Command" button to each fix request in the FixRequestQueue. When clicked, it calls the existing `generate-fix-prompt` edge function with the error details, then shows a copyable prompt you can paste directly into Lovable chat.

## Changes

### 1. Modify `src/components/ceo/FixRequestQueue.tsx`
- Add a "magic wand" / "Sparkles" button per fix request row
- On click, call `supabase.functions.invoke("generate-fix-prompt")` with the request's description, affected_area, and any screenshot URL
- Show a dialog/toast with the generated prompt and a "Copy" button
- Add loading state per request while generating

### 2. No backend changes needed
The `generate-fix-prompt` edge function already accepts title, description, screenshots, and priority -- it will work as-is with fix request data.

## Result
Each fix request gets a button that generates a detailed, structured Lovable command prompt. One click to generate, one click to copy, paste into Lovable chat to fix the code bug.

