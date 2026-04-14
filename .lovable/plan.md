

## Plan: Single Column Per Layer

### Problem
Layers with many nodes (e.g., AI/Automation with 29 nodes) wrap into multiple sub-columns, making the layout confusing. User wants each layer as exactly one vertical column.

### Fix (`src/lib/architectureFlow.ts`)
- Change `maxPerColumn` from `14` to `50` — this ensures even the largest layer (29 nodes) stays in a single column
- All cards will stack vertically under their layer header

### Files
| File | Change |
|---|---|
| `src/lib/architectureFlow.ts` | `maxPerColumn: 14` → `maxPerColumn: 50` |

### Result
- Each layer is exactly one column
- All cards stack vertically under their layer header
- No more split sub-columns

