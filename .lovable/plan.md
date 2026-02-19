
# Fix Code Block Display in Empire Builder Chat — YAML Text Cut Off

## Scope Lock

- File: `src/components/chat/RichMarkdown.tsx` ONLY
- Section: The `code` component renderer (lines 213–232) and the outer wrapper div (line 65)
- Do NOT touch: any other component, page, styling, or logic

## Problem

In the `/empire` chat, the AI's response contains a `YAML` code block. The text inside it is cut off at the right edge because:

1. The outer `RichMarkdown` wrapper has `[overflow-wrap:anywhere]` — this CSS rule bleeds into `<pre><code>` blocks and forces code to word-wrap at **any** character, breaking structured content at random points.
2. The `<pre>` has `overflow-x-auto` but the outer container's `overflow-hidden` suppresses the horizontal scrollbar.
3. The `<code>` tag has no explicit `whitespace` or `overflow-wrap` override, so it inherits the bad behavior.

## Fix Steps

### Step 1 — Add `whitespace-pre` and override `overflow-wrap` on the `<code>` tag (line 222)

Change:
```tsx
<code className="text-xs font-mono text-foreground/90">{children}</code>
```

To:
```tsx
<code className="text-xs font-mono text-foreground/90 whitespace-pre [overflow-wrap:normal]">{children}</code>
```

This ensures:
- `whitespace-pre` — preserves line breaks and prevents wrapping inside code blocks
- `[overflow-wrap:normal]` — overrides the parent's `[overflow-wrap:anywhere]` so long lines scroll instead of breaking at every character

### Step 2 — Fix the `<pre>` to allow horizontal scrolling (line 221)

Change:
```tsx
<pre className="bg-muted/40 p-3 overflow-x-auto max-w-full">
```

To:
```tsx
<pre className="bg-muted/40 p-3 overflow-x-auto max-w-full scrollbar-thin">
```

And wrap the entire code block outer `<div>` to allow its children to scroll by using `overflow-hidden` only for the border-radius (already present), but ensure the pre doesn't get clipped. The `overflow-hidden` on the code block's wrapper div (line 217) is fine for border-radius but we must ensure the `<pre>` scroll is not suppressed.

### Step 3 — Ensure the label header text is correct

The label currently reads `codeClassName?.replace("language-", "") || "code"` at line 219. For YAML blocks sent as ` ```yaml `, this correctly outputs "yaml". No change needed here.

## Result

| Before | After |
|---|---|
| YAML lines cut off at right edge | YAML block scrolls horizontally, all text visible |
| `overflow-wrap:anywhere` breaks code at random characters | `overflow-wrap:normal` preserves code structure |
| Lines like `unknowns: [The exact file path...]` are truncated | Full line visible with horizontal scroll |

## Files Changed

| File | Lines | Change |
|---|---|---|
| `src/components/chat/RichMarkdown.tsx` | 221–222 | Add `whitespace-pre [overflow-wrap:normal]` to `<code>` tag |

## Rollback

Remove `whitespace-pre [overflow-wrap:normal]` from the `<code>` className to revert.
