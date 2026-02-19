
# Fix: "Lovable Command" Code Block Displays as Broken Inline Text

## Root Cause

The Architect agent wraps its "📋 Lovable Command" in a plain fenced code block (no language tag):

````
```
📋 Lovable Command (copy & paste into Lovable chat):
───────────────────────────────────────────────────
[prompt text here]
```
````

In `RichMarkdown.tsx`, the `code` renderer checks `codeClassName?.includes("language-")` to decide if it's a block or inline. Because there is **no language tag**, `isBlock = false` — so the entire multi-line prompt renders as **inline code** with `break-all`, causing each character to break at the edge of the bubble.

## Scope Lock

- File: `src/components/chat/RichMarkdown.tsx` ONLY
- Section: The `code` component renderer (lines 212–231)
- Do NOT touch: EmpireBuilder.tsx, any other page, any other component

## Fix Steps

### Step 1 — Fix unlanguaged fenced code blocks

The `pre` renderer currently returns `<>{children}</>` (passes through to `code`). Instead, we need to detect when `code` is **inside a `pre`** (meaning it's a fenced block) even without a language tag.

The correct react-markdown approach: any code inside a `<pre>` renders with `node.position` set; the `code` component receives a `node` prop. The reliable way is to check if `className` is present **or** if the `children` string contains newlines (multi-line = block):

Change the `isBlock` detection from:
```tsx
const isBlock = codeClassName?.includes("language-");
```
To:
```tsx
const text = String(children ?? "");
const isBlock = codeClassName?.includes("language-") || text.includes("\n");
```

This ensures any multi-line code (including the unlanguaged Lovable Command block) renders as a proper scrollable block.

### Step 2 — Add a Copy button + special styling for Lovable Command blocks

Detect if the code content starts with `📋 Lovable Command` and render a special highlighted header with a **Copy** button instead of the generic language label:

```tsx
const isLovableCommand = text.trimStart().startsWith("📋 Lovable Command");

if (isBlock) {
  return (
    <div className="my-3 rounded-lg overflow-hidden border border-border/50">
      <div className="bg-muted/80 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-bold border-b border-border/50 flex items-center justify-between">
        <span>
          {isLovableCommand
            ? "📋 Lovable Command"
            : (codeClassName?.replace("language-", "") || "code")}
        </span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(text);
            // visual feedback optional
          }}
          className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-bold transition-colors"
        >
          <Copy className="w-2.5 h-2.5" />
          Copy
        </button>
      </div>
      <pre className="bg-muted/40 p-3 overflow-x-auto max-w-full scrollbar-thin">
        <code className="text-xs font-mono text-foreground/90 whitespace-pre [overflow-wrap:normal]">
          {children}
        </code>
      </pre>
    </div>
  );
}
```

### Step 3 — Add `Copy` icon import

Add `Copy` to the existing lucide-react imports at the top of `RichMarkdown.tsx`:

```tsx
import {
  CheckCircle2, AlertTriangle, Info, TrendingUp, TrendingDown,
  Minus, ArrowRight, RefreshCw, Download, Copy   // <-- add Copy
} from "lucide-react";
```

## Result

| Before | After |
|---|---|
| Lovable Command rendered as broken inline code with `break-all` | Renders as proper scrollable block with fixed-width mono font |
| Text wraps chaotically at every character | Long lines scroll horizontally, no wrapping |
| No copy button | One-click Copy button in the header |
| Generic "code" label | Shows "📋 Lovable Command" label |

## Files Changed

| File | Lines | Change |
|---|---|---|
| `src/components/chat/RichMarkdown.tsx` | 2, 213–231 | Add `Copy` import; fix `isBlock` detection; add copy button to block header |

## Rollback

Revert `isBlock` to `const isBlock = codeClassName?.includes("language-");` and remove the Copy button JSX.
