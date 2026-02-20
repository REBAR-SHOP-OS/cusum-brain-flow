

# Auto-Scope: AI-Recommended Scope of Work

## What This Does

When a user uploads drawings but leaves the "Scope / Context" field empty, the system will automatically analyze the uploaded files using AI and recommend a scope of work. The user sees the AI suggestion pre-filled in the scope field and can accept it as-is, edit it, or clear it entirely.

## How It Works

### 1. New Edge Function: `analyze-scope`

A lightweight backend function that takes the uploaded file URLs, runs a quick Gemini Flash scan on the first few pages, and returns a recommended scope of work.

**Input:** `{ file_urls: string[] }`
**Output:** `{ scope: string, elements_found: string[], confidence: number }`

The AI prompt instructs Gemini to:
- Identify structural element types visible in the drawings (footings, walls, beams, columns, slabs, etc.)
- Note drawing sheet numbers and revision info
- Identify the project name/address if visible on the title block
- Suggest a concise scope statement like: "Estimate all reinforcing steel for footings F1-F4, grade beams GB1-GB3, and retaining walls W6-W10 as shown on sheets SD-01 through SD-05"

Uses `gemini-2.5-flash` (fast + cheap) since this is a quick pre-scan, not the full deep OCR.

### 2. Updated TakeoffWizard Flow (Step 2)

When the user arrives at Step 2 (project details):
- A "Analyze Scope" button appears next to the Scope field (with a sparkle/wand icon)
- Clicking it calls `analyze-scope` with the uploaded file URLs
- While analyzing, a small spinner shows "AI analyzing drawings..."
- When complete, the AI-suggested scope populates the textarea
- A small badge shows "AI Suggested" so the user knows it was auto-generated
- The user can freely edit the text or clear it

If the user already typed something in the scope field, the button still works but asks confirmation before overwriting.

### 3. Auto-Trigger Option

When the user moves from Step 1 to Step 2 and the scope field is empty, the analysis runs automatically in the background. By the time the user fills in the project name and customer, the scope suggestion is ready. If it finishes before the user types anything, it pre-fills silently with the "AI Suggested" badge.

## Technical Details

### New file: `supabase/functions/analyze-scope/index.ts`
- Accepts `file_urls` array
- Downloads first 3 files (to keep it fast)
- Converts to base64, sends to Gemini 2.5 Flash with a scope-identification prompt
- Returns structured scope recommendation
- Uses `callAI` from the shared `aiRouter`

### Modified file: `src/components/estimation/TakeoffWizard.tsx`
- Add state: `aiScope`, `scopeLoading`, `scopeSource` ("manual" or "ai")
- On transition to Step 2: trigger `analyze-scope` in background
- Show loading indicator and "AI Suggested" badge on the scope textarea
- Add a manual "Analyze Scope" button with sparkle icon
- Pre-fill `scopeContext` when AI result arrives (only if field is still empty)

### No database changes required
- The scope text flows through to `ai-estimate` the same way it does today
- No new tables or columns needed

## User Experience

1. User uploads drawings (Step 1)
2. User clicks "Next" to Step 2
3. While user types project name and selects customer, AI silently analyzes the drawings
4. By the time user reaches the Scope field, it already shows something like:
   > "Estimate reinforcing steel for footings F1-F6, grade beams GB1-GB4, retaining walls W6-W10, and pool slab PS1 per sheets SD-01 to SD-08"
5. User can edit, accept, or clear it
6. User clicks "Run AI Takeoff" -- the scope (whether AI-suggested or user-edited) goes to `ai-estimate` as before

