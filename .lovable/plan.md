## Plan — Cutter station big number must use same unit as the production card

### What you're seeing

On the cutter station you see:

```text
   CUT EACH PIECE TO
✂        60"        📏
        IN
```

But the production (unit) card for the same item shows the length in a different unit (e.g. `5'-0"` FT‑IN, or `5 FT`). The two should always agree.

### Root cause (verified live)

For the active item on this station (`A1001`):

| Field | DB value |
|---|---|
| `source_total_length_text` | `60"` |
| `unit_system` | `in` |
| `cut_length_mm` | `60` (suspect — separate issue, not in scope) |

The big "Cut Each Piece To" block in `CutterStationView.tsx` (lines 916–937) renders `source_total_length_text` raw and then derives the unit label by string-matching `'` / `"` in that text:

- contains `'` and `"` → `FT-IN`
- contains `'` only → `FT`
- contains `"` only → `IN`
- else → `MM`

The same string-match logic is in `ProductionCard.tsx` (lines 173–184). They look identical, but they don't always produce the same display because:

1. `source_total_length_text` is whatever the importer extracted (e.g. `60"`, `5'`, `5'-0"`, or `1524`). One source, many possible spellings.
2. The production card and rebar tag (`RebarTagCard`) ALSO have a `formatMmToFtIn(cut_length_mm)` fallback path. When `source_total_length_text` is missing or stripped on one surface but present on the other, the two render different units for the same physical length.
3. Operator override / re-imports can leave `source_total_length_text` set on one row and cleared on a downstream row.

Result: the engine shows `60"` (raw inches) while the unit card / tag for the next mark in the same job shows `5'-0"` — same length, different unit.

### Fix — one source of truth for the cut-length display

Add a tiny shared formatter and use it in both places so the engine's big number and the production card's center number are byte-identical for the same item.

1. **New helper** `src/lib/cutLengthDisplay.ts` (~25 lines)
   - `formatCutLength(item, { preferSourceText?: boolean }) → { value: string, unitLabel: 'FT-IN'|'FT'|'IN'|'MM' }`
   - Rule: if `unit_system` is imperial (`in`, `ft`, `imperial`), ALWAYS render via `formatMmToFtIn(cut_length_mm)` — never trust `source_total_length_text` alone. This guarantees `60"` and `5'-0"` collapse to the same canonical form everywhere.
   - If `unit_system` is metric, render `cut_length_mm` + `MM`.
   - `source_total_length_text` is kept only for the small "as imported" caption under the tag, not for the big number.

2. **`src/components/shopfloor/CutterStationView.tsx`** (lines 916–937)
   - Replace the inline render + string-match with `formatCutLength(currentItem)`.

3. **`src/components/shopfloor/ProductionCard.tsx`** (lines 173–184 and 168–170)
   - Replace the inline render + string-match with the same `formatCutLength(item)` call.

4. **`src/components/office/RebarTagCard.tsx`** (Length cell, ~line ~110)
   - Use `formatCutLength` instead of `sourceLength || formatVal(...)` so printed tags also match.

### Out of scope

- The suspect `cut_length_mm = 60` for `A1001` (likely should be `1524`). That's an importer bug — separate ticket.
- No DB writes. No changes to bar/strokes math. No changes to other stations.

### Expected result

| Surface | Before | After |
|---|---|---|
| Cutter "Cut Each Piece To" | `60"` IN | `5'-0"` FT-IN |
| Production card center | `60"` IN | `5'-0"` FT-IN |
| Printed rebar tag Length | `60"` | `5'-0"` |
| Metric items | `1524 MM` | `1524 MM` (unchanged) |

All three surfaces — engine, on-screen card, printed tag — will always show the exact same string for the same item.

### Files touched

1. `src/lib/cutLengthDisplay.ts` — new (~25 lines)
2. `src/components/shopfloor/CutterStationView.tsx` — 1 block replaced
3. `src/components/shopfloor/ProductionCard.tsx` — 1 block replaced
4. `src/components/office/RebarTagCard.tsx` — 1 cell updated
