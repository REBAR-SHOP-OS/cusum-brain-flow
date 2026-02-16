

# Fix Typing Bug and Enable File Analysis in App Builder

## Issue 1: Typing Stops After 1 Character (Critical)

**Root cause**: `InputBox` is defined as a function component *inside* the `EmpireBuilder` render body (line 235). Every keystroke calls `setValue`, which re-renders `EmpireBuilder`, which creates a brand-new `InputBox` function. React sees it as a different component type, so it unmounts the old textarea and mounts a new one -- destroying focus and cursor position.

**Fix**: Convert `InputBox` from an inline component to a regular `<div>` block rendered directly in the JSX. Instead of `<InputBox large />` and `<InputBox />`, inline the markup at both usage sites (lines 378 and 465). The textarea, file chips, and buttons stay exactly the same -- they just stop being wrapped in a component function that gets recreated every render.

Alternatively, extract `InputBox` to a separate file or use `useMemo`, but the simplest and cleanest fix is inlining the JSX since it already references parent state directly.

**File**: `src/pages/EmpireBuilder.tsx`
- Remove the `InputBox` function definition (lines 235-293)
- Replace `<InputBox large />` (line 378) with the inline JSX (with `large` variants applied)
- Replace `<InputBox />` (line 465) with the inline JSX (with non-large variants applied)

## Issue 2: Uploaded Photos/PDFs Are Not Analyzed (Critical)

**Root cause**: In `supabase/functions/ai-agent/index.ts`, file processing is gated behind `agent === "estimation"` (line 4618). The `empire` agent receives `attachedFiles` but never processes them, so the AI only sees the text "Analyze these files" with no actual file content.

**Fix**: Add a file-processing block for the `empire` agent right after the estimation block (after line 4654). When `agent === "empire" && attachedFiles.length > 0`:
- Loop through attached files
- For images: call `analyzeDocumentWithGemini` with a general analysis prompt ("Describe everything you see in this image in detail")
- For PDFs: call `analyzeDocumentWithGemini` with a document analysis prompt
- Append all extracted text/analysis to the `message` variable so the AI model sees the file contents

This reuses the existing `analyzeDocumentWithGemini` helper already defined in the file (line 67).

## Files to Modify

| File | Change |
|---|---|
| `src/pages/EmpireBuilder.tsx` | Inline the `InputBox` JSX to fix the typing/focus bug |
| `supabase/functions/ai-agent/index.ts` | Add file processing block for `empire` agent after the estimation block |

