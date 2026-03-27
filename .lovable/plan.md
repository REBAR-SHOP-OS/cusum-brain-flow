

# Redesign RebarTagCard to Match ZPL Printed Tag

## Physical Printed Tag Layout (from ZPL code)

```text
┌─────────────────────────────────────────────────┐
│ REBAR.SHOP OS                    2026-03-27 01:22│  ← timestamp row
├───────────────┬─────────────────┬────────────────┤
│    MARK       │      SIZE       │     GRADE      │  ← 3-col header
│    A1001      │      10M        │     400W       │
├───────────────┴─────────────────┴────────────────┤
│                                                   │
│  QTY:                 LENGTH (mm):                │  ← qty + length row
│   18                    1048                      │
├──────────────────────────────────────────────────┤
│  WEIGHT:                                          │  ← weight row
│   14.81 kg                                        │
├──────────────────────────────────────────────────┤
│  DIMS:                                            │  ← dims section
│   A:457  B:133  C:457                             │
├──────────────────────────────────────────────────┤
│          |||BARCODE|||                             │  ← barcode
│            A1001                                  │
├──────────────────────────────────────────────────┤
│  DWG: SD01   ITEM: 1                             │  ← dwg/item row
│  REF: 2277                                        │  ← ref row
├──────────────────────────────────────────────────┤
│  REBAR.SHOP OS                   2026-03-27 01:22│  ← footer
└──────────────────────────────────────────────────┘
```

## Current Card vs Printed Tag — Key Differences

| Current Card | Printed Tag (ZPL) |
|---|---|
| 5-col header (Mark/Size/Grade/Qty/Len) | 3-col header (Mark/Size/Grade) only |
| Left sidebar with repeated specs | No sidebar — linear top-to-bottom |
| Center shape circle + dims | Dims listed as flat text rows |
| Right shape image | No shape image section |
| Bottom 3-col info row | Separate Dwg/Item row + Ref row |
| Barcode in footer | Barcode in middle, before Dwg/Item |
| No timestamp | Timestamp header + footer |

## Plan

Rewrite `RebarTagCard.tsx` to match the ZPL vertical flow:

1. **Timestamp header**: "REBAR.SHOP OS" left, current date/time right
2. **3-column header**: MARK / SIZE / GRADE with large values
3. **QTY + LENGTH row**: Two columns, label above value
4. **WEIGHT row**: Full width
5. **DIMS section**: Label "DIMS:" then active dims listed in chunks of 4 per line (matching `buildDimLines` logic)
6. **Barcode area**: Centered barcode placeholder + mark text
7. **DWG/ITEM + REF rows**: "DWG: {dwg}   ITEM: {item}" then "REF: {reference}"
8. **Footer**: "REBAR.SHOP OS" left, timestamp right

Remove: left sidebar, shape circle, shape image section, 5-col header. The shape image and dims grid are replaced by the flat dims text matching the printed output.

Keep: all existing props (shapeImageUrl can be ignored in rendering), format functions, imperial conversion.

## File Changed
- `src/components/office/RebarTagCard.tsx` — full rewrite to match ZPL printed layout

