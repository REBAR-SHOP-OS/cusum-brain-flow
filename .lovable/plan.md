
# Generate Fix Button — Surgical Enhancement

## Scope
**ONLY** `supabase/functions/generate-fix-prompt/index.ts` and the Generate Fix section in `src/pages/Tasks.tsx`.
No other UI, logic, database, or component is touched.

## Problems Identified

### Problem 1 — Screenshot URL Missed from Description
The current regex in `Tasks.tsx` (lines 930-938) uses:
```
/(https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp|svg)[^\s]*)/gi
```
But the Supabase storage URL for feedback screenshots ends in `.png` followed by nothing — which means this regex **should** catch it. However, the issue is that the description field contains the full text block including `Screenshot: <url>` and the regex only looks in `comments` and `description`, but does NOT specifically parse the structured `Screenshot:` line format. When the URL is embedded mid-text (with surrounding text), the regex boundary `[^\s]*` can cut off at spaces that appear in some encoded URLs, causing misses.

### Problem 2 — AI Model Has No Vision Capability  
The `generate-fix-prompt` function uses `gpt-4o-mini` (text only) and sends screenshot URLs as plain text references — the AI cannot actually **see** the screenshot. For feedback tasks that include a screenshot URL, the AI should use `gpt-4o` (with vision) to analyze the actual image content, producing a far more accurate fix prompt.

### Problem 3 — Prompt Quality & Surgical Rules
The generated prompt does NOT include the Surgical Execution Law constraints. Lovable AI receiving this prompt may make broad, sweeping changes. The system prompt must instruct the AI to embed surgical constraints in the output prompt.

### Problem 4 — No Visual Feedback on Screenshot Detection
The UI shows no indicator of how many screenshots were detected before generating. Users cannot verify the right context is being sent.

## Solution

### Change 1 — `supabase/functions/generate-fix-prompt/index.ts`
Upgrade the edge function to:
1. **Detect if screenshot URLs are present** → switch to `gpt-4o` with vision (multimodal) to actually analyze the screenshot image
2. **Build a richer vision message** that sends `image_url` content blocks alongside text for screenshot URLs
3. **Inject Surgical Execution Law** into the system prompt so the generated prompt always constrains Lovable AI to the specific file/component
4. **Improve prompt output format** — add mandatory sections: `PROBLEM`, `FILE/COMPONENT`, `EXACT CHANGE`, `DO NOT TOUCH`

Updated system prompt addition:
```
MANDATORY: Every generated prompt MUST include these sections:
- **PROBLEM:** one-line summary
- **FILE/COMPONENT:** exact file path(s) if identifiable
- **FIX:** surgical change instructions
- **DO NOT TOUCH:** explicitly list everything else that must NOT change
- **SURGICAL LAW:** "Change ONLY the section listed above. Do not modify any other UI, logic, database, or component."
```

Vision support: when screenshots exist, build messages array with image_url content blocks for GPT-4o vision, so the AI actually sees what's in the screenshot.

### Change 2 — `src/pages/Tasks.tsx` (Generate Fix section only)
Improve screenshot extraction to also parse the structured `Screenshot: <url>` line format from feedback descriptions:
```typescript
// Parse "Screenshot: <url>" lines explicitly  
const screenshotLineRegex = /Screenshot:\s*(https?:\/\/[^\s]+)/gi;
let match;
while ((match = screenshotLineRegex.exec(selectedTask.description || "")) !== null) {
  screenshots.push(match[1]);
}
// Also run generic image URL regex as fallback
```

Add a small visual indicator showing how many screenshots were detected:
```tsx
{detectedScreenshots > 0 && (
  <span className="text-xs text-muted-foreground">
    📎 {detectedScreenshots} screenshot(s) detected
  </span>
)}
```

## Files Changed
| File | Change |
|------|--------|
| `supabase/functions/generate-fix-prompt/index.ts` | Vision support + Surgical Law injection + better prompt format |
| `src/pages/Tasks.tsx` | Better screenshot URL extraction + detection indicator |

## What Does NOT Change
- Task list UI, columns, Kanban board
- Comment system
- Audit log
- Create task dialog
- Delete/Complete/Reopen logic
- Any other page or component
- Database schema
