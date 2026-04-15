

## Plan: Switch Tag Font to OCR-B or Share Tech Mono for Clear 0 vs 8

### Problem
Roboto Mono's `0` and `8` still look too similar at heavy weights on printed tags — the zero lacks a distinctive slash/dot.

### Solution
Switch to **Share Tech Mono** — a Google Font designed for technical/industrial readability. Its zero has a clearly visible dot inside, making it unmistakable from `8` at any weight. Alternative: **Source Code Pro** (also has dotted zero and multiple weights).

**Recommendation**: **Source Code Pro** — it has weights 400–900, a dotted zero, and excellent print legibility.

### Changes

| File | Change |
|------|--------|
| `index.html` | Replace Roboto Mono import with `Source Code Pro` (wght 400;500;700;900) |
| `src/index.css` | Update `@import` to Source Code Pro |
| `tailwind.config.ts` | Change `font-mono` primary to `'Source Code Pro'` |
| `src/pages/PrintTags.tsx` | Update print `font-family` to `'Source Code Pro'` |

### What does NOT change
- Tag layout, sizing, colors — untouched
- No logic or database changes

