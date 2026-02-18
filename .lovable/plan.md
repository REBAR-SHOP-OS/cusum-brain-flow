
# Zebra ZT411 ZPL Export — Tags & Export Section Only

## Scope (Strict)
Exactly 3 files change:
- `src/components/office/TagsExportView.tsx` — replace single "Print Tags" button with a split button (Print Tags keeps existing behaviour; new "Zebra ZT411" option added)
- `src/utils/generateZpl.ts` — NEW: pure utility that converts row data to ZPL strings
- `src/components/office/ZebraZplModal.tsx` — NEW: modal showing generated ZPL with Copy + Download buttons

Zero changes to: `RebarTagCard.tsx`, CSV export logic, data hooks, database, RLS, any other page or component.

---

## ZPL Specification

Label size: 4 × 6 inch @ 203 DPI
- Width: 4 × 203 = **812 dots** → `^PW812`
- Height: 6 × 203 = **1218 dots** → `^LL1218`
- Safe margin: 0.125 in = ~25 dots on each side → content zone: x: 25–787, y: 25–1193

Each tag = one ZPL block (`^XA … ^XZ`). All blocks are concatenated into one `.zpl` file.

### ZPL Layout Per Label (top → bottom):

```text
┌─────────────────────────────────────────┐  y=25
│  MARK: 10A07      SIZE: 10M  GRADE:400W │  (large fonts)
├─────────────────────────────────────────┤  y=180
│  QTY: 24          LENGTH: 1295mm        │
├─────────────────────────────────────────┤  y=310
│  WEIGHT: 24.4 kg                        │
├─────────────────────────────────────────┤  y=390
│  DIMS: A:610  B:—  C:—  D:—            │
│        E:—    F:—  G:—  H:—            │
├─────────────────────────────────────────┤  y=540
│  [Code128 barcode of MARK]             │
│  10A07                                  │
├─────────────────────────────────────────┤  y=850
│  DWG: R01   ITEM: 1                    │
│  REF: Ford Oakville                     │
├─────────────────────────────────────────┤  y=1000
│  ─────────────────────────────────────  │
│  REBAR.SHOP OS              [timestamp] │
└─────────────────────────────────────────┘  y=1193
```

### ZPL Commands Used
- `^CF0,` — Zebra scalable font A (built-in, always available)
- `^FO` — field origin (x, y)
- `^FD` — field data
- `^FS` — field separator
- `^GB` — graphic box (divider lines)
- `^BC` — Code 128 barcode
- `^XA` / `^XZ` — label start/end

### ZPL Template (per row)

```zpl
^XA
^PW812
^LL1218
^CI28
^MMT

^CF0,60
^FO25,30^FDMARK^FS
^CF0,100
^FO25,80^FD{mark}^FS

^CF0,60
^FO300,30^FDSIZE^FS
^CF0,100
^FO300,80^FD{size}^FS

^CF0,60
^FO560,30^FDGRADE^FS
^CF0,100
^FO560,80^FD{grade}^FS

^GB762,3,3^FO25,195^FS

^CF0,50
^FO25,210^FDQTY:^FS
^CF0,80
^FO25,255^FD{qty}^FS

^CF0,50
^FO300,210^FDLENGTH (mm):^FS
^CF0,80
^FO300,255^FD{length}^FS

^GB762,3,3^FO25,350^FS

^CF0,50
^FO25,365^FDWEIGHT:^FS
^CF0,80
^FO25,410^FD{weight} kg^FS

^GB762,3,3^FO25,510^FS

^CF0,40
^FO25,525^FDDIMS^FS
{dim_lines}

^GB762,3,3^FO25,680^FS

^BY3,3,100
^FO200,720^BC,,Y,N^FD{mark}^FS

^GB762,3,3^FO25,870^FS

^CF0,45
^FO25,890^FDDWG: {dwg}   ITEM: {item}^FS
^CF0,45
^FO25,945^FDREF: {reference}^FS

^GB762,3,3^FO25,1010^FS

^CF0,35
^FO25,1025^FDREBAR.SHOP OS^FS
^CF0,35
^FO500,1025^FD{timestamp}^FS

^XZ
```

DIM lines: iterate A–R, skip nulls/zeros, print in 2-column layout at y=540–670.

---

## UI Change in TagsExportView.tsx

Replace the current single "Print Tags" `<Button>` with a **split button group**:

```tsx
{/* Print Tags split button */}
<div className="flex items-center">
  <Button size="sm" className="gap-1.5 text-xs h-8 rounded-r-none" onClick={handlePrint}>
    <Printer className="w-3.5 h-3.5" /> Print Tags
  </Button>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button size="sm" className="h-8 px-1.5 rounded-l-none border-l border-primary-foreground/30">
        <ChevronDown className="w-3.5 h-3.5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={handleZebraZPL}>
        <Tag className="w-3.5 h-3.5 mr-2" />
        Zebra ZT411 (4×6 in) — ZPL
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

A new `useState<boolean>` controls the `ZebraZplModal` open state.

---

## ZebraZplModal Component

```
┌─────────────────────────────────────────────────┐
│ 🖨  Zebra ZT411 — ZPL Output               ×   │
├─────────────────────────────────────────────────┤
│  4×6 in · 203 DPI · {n} labels                 │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ ^XA                                       │  │
│  │ ^PW812                                    │  │
│  │ ^LL1218                                   │  │
│  │ ...                                       │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  [Copy ZPL]          [Download .zpl]            │
└─────────────────────────────────────────────────┘
```

- Scrollable `<pre>` with monospace font showing the full ZPL string
- **Copy ZPL** → `navigator.clipboard.writeText(zpl)` + toast "Copied!"
- **Download .zpl** → creates Blob, triggers `<a>` download with filename `{session-name}.zpl`
- Modal uses existing `Dialog` component from shadcn/ui (already installed)

---

## Files Changed

| File | Action | Scope |
|------|--------|-------|
| `src/utils/generateZpl.ts` | New | Pure ZPL generation, no side effects |
| `src/components/office/ZebraZplModal.tsx` | New | Modal UI — Copy + Download |
| `src/components/office/TagsExportView.tsx` | Edit | Split button + state + modal render |

**No other files changed. No database. No other pages.**
