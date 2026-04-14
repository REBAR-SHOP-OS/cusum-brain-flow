

## Plan: Match Shop Floor Length Display to Extract Session Unit

### Problem
The shop floor always shows lengths in raw mm with a hardcoded "MM" label, even when the source barlist was extracted in ft-in or inches. The Detailed List respects the session's unit — the shop floor should too.

### Data Flow
`cut_plan_items` already has `source_total_length_text` (e.g. "6'6\"", "4'"). The chain to get the unit system is: `cut_plan_items` → `cut_plans.barlist_id` → `barlists.extract_session_id` → `extract_sessions.unit_system`. However, `source_total_length_text` is the simplest path — it already contains the formatted value.

### Approach
Use `source_total_length_text` directly when available (it preserves the exact display from the barlist). Fall back to `formatLengthByMode` with the session unit when source text is missing.

### Changes

**1. `src/hooks/useStationData.ts` — Add `source_total_length_text` to StationItem**
- Add `source_total_length_text: string | null` to the `StationItem` interface
- Already selected via `select("*")` so no query change needed
- Map it in both cutter and bender item transforms

**2. `src/components/shopfloor/CutterStationView.tsx` — Use source text for big cut length**
- Line ~907: Replace `{currentItem.cut_length_mm}` with `{currentItem.source_total_length_text || currentItem.cut_length_mm}`
- Line ~912: Replace hardcoded "MM" with dynamic unit label derived from source text (detect `'` → FT-IN, `"` → IN, else → MM)
- Also fix `font-mono` → `font-sans tabular-nums` on this big number (missed in previous pass)

**3. `src/components/shopfloor/ProductionCard.tsx` — Use source text for card lengths**
- Line ~169: Replace `{item.cut_length_mm} mm` with source text or formatted value
- Line ~175: Same for the large straight-bar display
- Line ~178: Replace hardcoded "MM Length" with dynamic unit label

**4. Fix runtime error: `src/components/office/OfficeSidebar.tsx`**
- The `Link is not defined` error appears from a stale build cache. The current file is correct but may need a trivial touch to force rebuild (will verify during implementation).

### Helper Logic
Add a small utility function to derive the unit label from `source_total_length_text`:
```typescript
function detectUnitFromSourceText(text: string | null): string {
  if (!text) return "MM";
  if (text.includes("'") && text.includes('"')) return "FT-IN";
  if (text.includes("'")) return "FT";
  if (text.includes('"')) return "IN";
  return "MM";
}
```

### Files
| File | Change |
|---|---|
| `src/hooks/useStationData.ts` | Add `source_total_length_text` to `StationItem` interface |
| `src/components/shopfloor/CutterStationView.tsx` | Display source text + dynamic unit label on big cut length |
| `src/components/shopfloor/ProductionCard.tsx` | Display source text + dynamic unit label on card lengths |

### Result
Shop floor displays lengths in the same unit as the Detailed List / AI Extract session — if the barlist was in ft-in, operators see ft-in on the shop floor too.

