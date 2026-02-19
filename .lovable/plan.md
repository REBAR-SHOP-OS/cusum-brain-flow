
# Fix: Code Block Box — White Background + Full Left-to-Right Visibility

## Scope Lock
- File: `src/components/chat/RichMarkdown.tsx` ONLY
- Lines: 65, 219–236
- Do NOT touch: any other component, logic, route, or style

## Problem (from screenshot)
The code block box has two issues:
1. **Dark background** — `bg-muted/40` renders as a dark grey/charcoal box; user wants a white/light background so the prompt text is clearly readable
2. **Content truncated on the right** — long lines are cut off. The outer wrapper div has `overflow-hidden` which clips the horizontal scrollbar inside `<pre>`. Also the outer `RichMarkdown` container has `[overflow-wrap:anywhere]` which still bleeds into the code block despite the fix on `<code>`, because `<pre>` itself can still be constrained

## Root Causes

### Issue 1 — Dark background
`bg-muted/40` = semi-transparent muted color (dark in dark theme). Must be changed to an explicit light background:
- Header: `bg-muted/80` → `bg-slate-100 dark:bg-slate-800`
- Body: `bg-muted/40` → `bg-white dark:bg-slate-900`

### Issue 2 — Content cut off
The outer wrapper div on line 65 has `overflow-hidden` AND `[overflow-wrap:anywhere]`. Even though the `<code>` tag has `[overflow-wrap:normal]`, the `<pre>` element does not have an explicit min-width, so the flex/block container can still compress it. The outer `overflow-hidden` on the `RichMarkdown` container also prevents the scrollbar from working correctly.

The `<div>` wrapping the code block (line 219) has `overflow-hidden` for border-radius — this clips the horizontal scroll of the inner `<pre>`.

## Fix Steps

### Step 1 — Fix outer RichMarkdown wrapper (line 65)
Remove `overflow-hidden` from the outer wrapper — it was there to clip content but it suppresses child scrollbars. Replace with `overflow-x-hidden` only on the text wrapper but allow pre blocks to scroll:

Change:
```tsx
<div className={cn("text-sm leading-relaxed break-words overflow-hidden max-w-full min-w-0 [overflow-wrap:anywhere]", ...)}
```
To:
```tsx
<div className={cn("text-sm leading-relaxed break-words max-w-full min-w-0 [overflow-wrap:anywhere]", ...)}
```

### Step 2 — Fix the code block wrapper div (line 219)
The `overflow-hidden` on the code block container clips horizontal scroll. Change to use `overflow-x-auto` at this level and remove `overflow-hidden`:

Change:
```tsx
<div className="my-3 rounded-lg overflow-hidden border border-border/50">
```
To:
```tsx
<div className="my-3 rounded-lg border border-border/60 overflow-x-auto">
```

### Step 3 — Fix header background (line 220)
Change from dark muted to a clearly visible light grey header:

```tsx
<div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-bold border-b border-border/50 flex items-center justify-between sticky left-0">
```

### Step 4 — Fix body background (line 234)
Change `<pre>` from dark muted to white/very light:

```tsx
<pre className="bg-white dark:bg-slate-900 p-3 overflow-x-auto min-w-0 scrollbar-thin">
```

Remove `max-w-full` from `<pre>` — this constrains the pre width, causing truncation. Instead let it grow naturally and scroll.

### Step 5 — Add `min-w-max` to the `<code>` (line 235)
Ensure the inner code tag never wraps:

```tsx
<code className="text-xs font-mono text-foreground/90 whitespace-pre [overflow-wrap:normal] block min-w-max">
```

The `block min-w-max` ensures the code expands to its natural width and the parent `<pre>` scrolls to accommodate it.

## Result

| Before | After |
|---|---|
| Dark grey/charcoal background | White background (dark mode: very dark slate) |
| Lines cut off on the right | All content visible, horizontal scroll works |
| Scrollbar appears but content still clipped | Scroll fully functional from first character to last |
| Header hard to read | Clear grey header with readable label |

## Files Changed

| File | Lines | Change |
|---|---|---|
| `src/components/chat/RichMarkdown.tsx` | 65 | Remove `overflow-hidden` from outer wrapper |
| `src/components/chat/RichMarkdown.tsx` | 219 | Change code block div to `overflow-x-auto`, remove `overflow-hidden` |
| `src/components/chat/RichMarkdown.tsx` | 220 | Header: `bg-slate-100 dark:bg-slate-800` |
| `src/components/chat/RichMarkdown.tsx` | 234 | Body: `bg-white dark:bg-slate-900`, remove `max-w-full` |
| `src/components/chat/RichMarkdown.tsx` | 235 | Code: add `block min-w-max` |

## Rollback
Revert lines 65, 219, 220, 234, 235 to their previous className values.
