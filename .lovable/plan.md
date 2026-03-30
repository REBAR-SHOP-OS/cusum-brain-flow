

# Fix: Persian Translation Leaking into Caption Field

## Root Cause

In `supabase/functions/auto-generate-post/index.ts` line 391-392, the `farsi_translation` field from the AI is appended to the saved content. The AI prompt instructs it to prefix with `---PERSIAN---`, but the AI sometimes omits the separator or embeds Persian directly in the `content` field. When the `---PERSIAN---` marker is missing, the `PostReviewPanel` frontend cannot split it out, so Persian text appears in the editable Caption textarea.

## Fixes

### Fix 1: Normalize `farsi_translation` separator (auto-generate-post)
**File**: `supabase/functions/auto-generate-post/index.ts` lines 391-392

Before appending `farsi_translation`, ensure `---PERSIAN---` is always present:
```typescript
let persianBlock = "";
if (post.farsi_translation) {
  const ft = post.farsi_translation.trim();
  persianBlock = ft.startsWith("---PERSIAN---") 
    ? "\n\n" + ft 
    : "\n\n---PERSIAN---\n" + ft;
}
content: stripPersianBlock(post.content || "") + persianBlock,
```

### Fix 2: Strip inline Persian from `post.content` (auto-generate-post)
**File**: `supabase/functions/auto-generate-post/index.ts` — enhance `stripPersianBlock`

Add a regex to remove any lines containing Persian/Arabic Unicode characters (U+0600–U+06FF) from the content field, as a safety net against AI embedding Persian directly in `content`:
```typescript
function stripPersianBlock(text: string): string {
  let t = text;
  const idx = t.indexOf("---PERSIAN---");
  if (idx !== -1) t = t.slice(0, idx);
  t = t.replace(/🖼️\s*متن روی عکس:[\s\S]*/m, "");
  t = t.replace(/📝\s*ترجمه کپشن:[\s\S]*/m, "");
  // Remove any remaining lines with Persian/Arabic script
  t = t.split("\n").filter(line => !/[\u0600-\u06FF]/.test(line)).join("\n");
  return t.trim();
}
```

### Fix 3: Frontend safety — strip Persian from `localContent` (PostReviewPanel)
**File**: `src/components/social/PostReviewPanel.tsx` lines 229-230

Add a fallback: even when no `---PERSIAN---` separator is found, detect and strip Persian text from `localContent` using `🖼️ متن روی عکس:` markers or Unicode range:
```typescript
} else {
  // No separator found — still strip any Persian markers or lines
  let cleaned = rawC;
  const persianMarker = cleaned.match(/🖼️\s*متن روی عکس:([\s\S]*?)(?=📝|$)/);
  const captionMarker = cleaned.match(/📝\s*ترجمه کپشن:([\s\S]*?)$/);
  if (persianMarker) {
    setPersianImageText(persianMarker[1]?.trim() || "");
    cleaned = cleaned.replace(persianMarker[0], "");
  }
  if (captionMarker) {
    setPersianCaptionText(captionMarker[1]?.trim() || "");
    cleaned = cleaned.replace(captionMarker[0], "");
  }
  // Strip any remaining lines with Persian/Arabic characters
  cleaned = cleaned.split("\n").filter(l => !/[\u0600-\u06FF]/.test(l)).join("\n");
  setLocalContent(cleaned.trim());
}
```

## Files to Change
1. `supabase/functions/auto-generate-post/index.ts` — normalize separator + enhance `stripPersianBlock`
2. `src/components/social/PostReviewPanel.tsx` — frontend fallback stripping

## Result
- Persian will never appear in Caption regardless of AI output format
- Persian will always be routed to the "Internal reference only" section
- Triple safety: backend strip + separator normalization + frontend fallback

