

## Plan: Replace Tag Font to Distinguish 0 from 8

### Problem
The current monospace font (`JetBrains Mono` / system monospace) renders `0` too similarly to `8` at heavy weights (`font-black`), causing misreads on printed rebar tags.

### Solution
Switch to **Roboto Mono** — a Google Font with a clearly distinguishable zero (open/rounded vs. the figure-8 shape). It's highly legible at all weights and well-suited for industrial print tags.

### Changes

**1. `index.html`** — Add Roboto Mono import from Google Fonts (weights 400–900)

**2. `src/index.css`** — Update `.font-mono` to use `'Roboto Mono'` as primary

**3. `src/pages/PrintTags.tsx`** — Update print page `font-family` to `'Roboto Mono'`

**4. `src/components/office/RebarTagCard.tsx`** — No changes needed (it uses Tailwind's `font-mono` class which will inherit the update)

### What does NOT change
- Tag layout, sizing, colors — untouched
- No database changes
- No logic changes

