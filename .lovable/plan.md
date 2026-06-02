## Goal
For rows whose TYPE is `STRAIGHT`, the Tags & Export table currently shows the same value in both column **A** and column **B** (e.g. AAS14 = 6600 / 6600). The convention is: straight bars carry the length in **B only**; **A must be blank**.

## Scope
UI-only normalization in the Tags & Export view. No DB writes, no extraction changes, no other dim columns touched.

## Change
File: `src/components/office/TagsExportView.tsx`

Add a helper:
```ts
const isStraight = (shapeType: string) =>
  /^straight$/i.test(shapeType?.trim() || "");
```

Apply in three render/export paths so the rule is consistent:

1. **Table view** (lines ~490–506) — inside the `DIM_COLS.map`, when `isStraight(shapeType) && d === "A"`, render an empty cell regardless of `srcDims.A` / `dim_a`.
2. **CSV export** (`handleExportCSV`, lines ~129–133) — when straight, emit `""` for column A.
3. **Zebra ZPL export** (`handleZebraZPL`, lines ~203–208) — when straight, set `dims.A = null`.
4. **Cards view** (lines ~541–551) — when straight, force `dims.A = null` and delete `sourceDims.A` so `RebarTagCard` matches the table.

Column **B** and all other dims stay exactly as they are today. Bent rows (types `2`, `6`, `10`, `C3`, `T1`, etc.) are unaffected.

## Validation
- AAS14 / AAS15 / AAS03 etc.: A blank, B = 6600 / 3500 / 6000.
- D1511 (type 6): unchanged — A=4239, B=2228, C=2512.
- CSV download + Zebra ZPL preview reflect the same blanking.
