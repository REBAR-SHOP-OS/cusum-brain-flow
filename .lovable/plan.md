

## Plan: Opaque Colored Cards + Larger Size + Proper Column Alignment

### Problems (from screenshot)
1. Cards have near-transparent backgrounds — hard to read against dark canvas
2. Cards are too small — text barely visible when zoomed out
3. Some cards appear outside their layer column (circled area in screenshot shows misaligned cards in AI/Automation)

### Changes

**1. Opaque colored backgrounds (`src/components/system-flow/ArchFlowNode.tsx`)**
- Replace the transparent `bg` values with solid, opaque dark-tinted colors per accent:
  - rose: `rgb(45, 20, 28)` — dark rose
  - orange: `rgb(45, 30, 15)` — dark orange  
  - violet: `rgb(30, 22, 50)` — dark violet
  - blue: `rgb(18, 28, 48)` — dark blue
  - emerald: `rgb(15, 38, 30)` — dark emerald
  - cyan: `rgb(12, 35, 42)` — dark cyan
- Remove `backdropFilter: "blur(16px)"` — not needed with opaque backgrounds
- Change background from gradient to solid opaque fill

**2. Larger card dimensions**
- `nodeWidth`: 160 → 190
- `nodeHeight`: 100 → 120
- `nodeGap`: 14 → 18
- Update card width in ArchFlowNode to match (190px)
- Increase font sizes: label 11px → 13px, hint 8px → 9px, description 9px → 10px
- Icon size: 22 → 26

**3. Layout constants (`src/lib/architectureFlow.ts`)**
- Update `nodeWidth`, `nodeHeight`, `nodeGap` to match new sizes
- Increase `layerGap` from 300 → 340 to prevent column overlap with wider cards

### Files
| File | Change |
|---|---|
| `src/components/system-flow/ArchFlowNode.tsx` | Opaque bg colors, larger card, bigger fonts |
| `src/lib/architectureFlow.ts` | Increase layout dimensions |

### Result
- All cards have solid, clearly visible colored backgrounds per layer
- Cards are larger and text is readable
- Every card sits under its layer column header

