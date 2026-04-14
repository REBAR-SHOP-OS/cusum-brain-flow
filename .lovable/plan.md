

## Plan: Solid Card Colors with Unique Color Per Layer

### Problem
1. Card backgrounds are very dark with subtle tints — hard to distinguish layers
2. Border colors use `rgba` (transparency) instead of solid colors
3. Two layers (`auth` and `platform`) share the same `emerald` accent, causing confusion

### Changes

**1. `src/lib/architectureGraphData.ts`**
- Change `platform` layer accent from `"emerald"` to `"cyan"` so every layer has a unique color:
  - external → rose
  - items → orange
  - ai → violet
  - backend → blue
  - auth → emerald
  - entry → cyan
  - platform → needs a new accent

Since `entry` already uses `cyan` and `platform` uses `emerald` (duplicate), we need a 7th accent. We'll add a **`amber`** accent for one of them, or reassign so no duplicates exist. Best approach: change `platform` to `"cyan"` and `entry` to a new accent like `"amber"` or `"teal"`.

Actually, with 7 layers and 6 accents, we need to add one more accent color.

**Reassignment** (all unique):
| Layer | Accent |
|---|---|
| external | rose |
| items | orange |
| ai | violet |
| backend | blue |
| auth | emerald |
| entry | cyan |
| platform | **amber** (new) |

**2. `src/components/system-flow/ArchFlowNode.tsx`**
- Add `amber` to `FlowAccent` type and `accentStyles`
- Make all `bg` values brighter/more saturated (solid, no transparency feel)
- Change all `border` values from `rgba(...)` to solid `rgb(...)` (no alpha)
- Increase bg brightness so cards are visually distinct per layer

Updated color scheme (solid, opaque):
| Accent | Border (solid) | Background (brighter) |
|---|---|---|
| cyan | rgb(34,211,238) | rgb(15,50,60) |
| emerald | rgb(52,211,153) | rgb(18,55,40) |
| violet | rgb(167,139,250) | rgb(40,30,65) |
| orange | rgb(251,146,60) | rgb(60,38,18) |
| blue | rgb(96,165,250) | rgb(22,38,65) |
| rose | rgb(251,113,133) | rgb(60,25,35) |
| amber | rgb(245,195,68) | rgb(55,42,15) |

### Files
| File | Change |
|---|---|
| `src/lib/architectureGraphData.ts` | Change platform accent to `"amber"` |
| `src/components/system-flow/ArchFlowNode.tsx` | Add `amber` accent, make all borders solid `rgb()`, brighten backgrounds |
| `src/components/system-flow/ArchColumnHeader.tsx` | Add `amber` to header accent styles if applicable |

### Result
- Every layer has its own unique, distinguishable color
- Card backgrounds are solid and clearly visible
- No transparency in borders — fully opaque colors

