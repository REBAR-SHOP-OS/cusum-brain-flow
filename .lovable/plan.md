
## Fix Print Layout Isolation

## What’s actually happening
The dedicated `/print-tags` route already exists, but the print page still reuses `RebarTagCard`, which is built with shared app utility classes (`flex`, `grid`, overflow rules). At the same time, `src/index.css` applies broad global print overrides. So even in a separate route, the tags are still influenced by shared layout/styling logic.

## Implementation plan

### 1. Make `/print-tags` fully self-contained
**Files:** `src/pages/PrintTags.tsx`, `src/App.tsx`

- Keep `/print-tags` as the dedicated print-only route with no app layout.
- Ensure this route renders only:
  - loading state
  - error/missing-session state
  - raw print container
  - tags
- No toolbar, no sidebar, no `ScrollArea`, no page shell.

### 2. Stop using the shared app card for printing
**Files:** `src/pages/PrintTags.tsx`, `src/components/office/RebarTagCard.tsx` or new print-only component

- Replace `RebarTagCard` usage inside `PrintTags.tsx` with a print-specific tag component or inline print markup.
- Reason: `RebarTagCard` currently includes shared Tailwind layout classes like `flex flex-col`, `grid`, and screen-oriented sizing behavior.
- The print version should use a dedicated structure styled only for 4x6 output.

### 3. Add isolated print-only styling
**Files:** `src/pages/PrintTags.tsx` and/or `src/index.css`

Create a narrowly scoped print surface for the print route, for example:

```text
.print-tags-page
  .print-tag
```

Apply:
- clean 4in canvas
- zero margins/padding
- standalone page per tag
- overflow visible on route container
- `page-break-after: always`
- exact `4in x 6in` tag sizing

If possible, move most print-route styling into `PrintTags.tsx` scope instead of relying on broad global `@media print` rules.

### 4. Reduce the global print CSS blast radius
**File:** `src/index.css`

- Keep only the truly global print rules needed for label printing.
- Scope rebar-tag-specific rules to the dedicated print route container instead of generic selectors where possible.
- Avoid using broad selectors that can affect unrelated print pages.

### 5. Preserve current print flow from office screen
**File:** `src/components/office/TagsExportView.tsx`

- Keep opening `/print-tags?...` in a new window.
- No change to the export workflow unless query params need tightening.

## Expected result
- Print preview renders in a clean window with no app chrome.
- No sidebar, no ScrollArea, no flex/grid wrapper interference from the office page.
- Each tag behaves like a standalone 4x6 page.
- No clipping, no scrollbar artifacts, no horizontal squeeze.

## Technical details
Current problem areas already visible in code:
- `src/pages/PrintTags.tsx` still renders shared `RebarTagCard`
- `src/components/office/RebarTagCard.tsx` uses app layout classes (`flex`, `grid`)
- `src/index.css` still contains broad print overrides affecting generic layout classes

The long-term stable fix is:
1. dedicated route
2. dedicated print markup
3. narrowly scoped print CSS
4. minimal dependence on shared app components for printed output
