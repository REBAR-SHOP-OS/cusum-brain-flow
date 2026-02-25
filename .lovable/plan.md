

## Fix: Screenshot Crashes on Pipeline Intelligence Page

### Problem

Taking a screenshot on the Pipeline Intelligence page (`/pipeline-intelligence`) crashes the browser tab. The page has 13 tabs, each containing recharts charts (SVGs), and the total DOM element count is very high (likely 5000+).

**Root causes:**

1. **Unbounded canvas dimensions** — After the ancestor expansion logic removes all `overflow: hidden` constraints, `target.scrollHeight` can balloon to 10,000+ px. Combined with `scrollWidth`, this creates a canvas that exceeds the browser's maximum canvas size (~16384px or ~268 million pixels), causing an allocation failure that crashes the tab.

2. **Hidden tab content rendered** — All 13 `TabsContent` components exist in the DOM simultaneously (Radix hides inactive ones with `display: none` or `data-state="inactive"`). When `overflow: visible` is applied globally, html2canvas still traverses all these nodes, multiplying the work.

3. **Recharts SVGs** — Each chart generates complex SVG trees. html2canvas struggles with these, especially when dozens are present simultaneously.

### Fix

**File: `src/components/feedback/ScreenshotFeedbackButton.tsx`**

#### Change 1: Cap maximum canvas dimensions (lines 69-70)

After calculating `captureWidth` and `captureHeight`, clamp them to a safe maximum to prevent browser canvas allocation failures:

```typescript
const MAX_DIM = 8192;
const captureWidth  = isOverlay ? window.innerWidth  : Math.min(target.scrollWidth, MAX_DIM);
const captureHeight = isOverlay ? window.innerHeight : Math.min(target.scrollHeight, MAX_DIM);
```

#### Change 2: Ignore hidden/inactive tab content in `baseIgnore` (lines 75-81)

Add a check to skip elements inside inactive Radix `TabsContent` panels so html2canvas doesn't render content the user can't see:

```typescript
const baseIgnore = (el: Element) => {
  const tag = el.tagName?.toLowerCase();
  if (tag === "iframe" || tag === "embed" || tag === "object") return true;
  if (el.getAttribute?.("data-feedback-btn") === "true") return true;
  if (el.classList?.contains("floating-vizzy")) return true;
  // Skip inactive tab panels (Radix TabsContent with data-state="inactive")
  if (el.getAttribute?.("data-state") === "inactive" && el.getAttribute?.("role") === "tabpanel") return true;
  return false;
};
```

#### Change 3: Lower scale for extremely heavy pages (line 114-115, 152)

Add a second tier for extremely heavy pages (>6000 elements) to use an even lower scale:

```typescript
const totalCount = target.querySelectorAll("*").length;
const isHeavyPage = totalCount > 3000;
const isExtremelyHeavy = totalCount > 6000;

// In captureOnce:
scale: isExtremelyHeavy ? 0.5 : (isHeavyPage ? 0.75 : 1),
```

### What stays the same
- Overlay/dialog path (unaffected — uses viewport dimensions)
- Restore logic in `finally` block
- Retry-without-images fallback
- Ancestor expansion for scroll capture on normal pages

### Files changed
1. `src/components/feedback/ScreenshotFeedbackButton.tsx` — 3 targeted changes

