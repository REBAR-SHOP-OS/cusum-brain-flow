

## Plan: Color-Coded Cards with Descriptions

### Problem
1. All cards have the same dark background — hard to visually distinguish layers
2. Cards only show label + tiny hint — no description of what each component does
3. User needs to understand the full architecture at a glance

### Changes

**1. Color-coded card backgrounds (`src/components/system-flow/ArchFlowNode.tsx`)**
- Change `background` from the current dark gradient to use the layer's accent color as a subtle tinted background (e.g., rose-tinted for External, violet-tinted for AI, cyan-tinted for Entry)
- Use `st.bg` (already defined but unused) as the card fill color, combined with a slightly stronger tint
- Add a left-side accent bar (3px solid accent color) for extra visual grouping

**2. Show description inside each card (`src/components/system-flow/ArchFlowNode.tsx`)**
- Display the first bullet from `detail.bullets[0]` as a small description line below the hint
- Style: 9px, white/60 opacity, max 2 lines with overflow ellipsis
- This gives immediate context (e.g., "React 18 + Vite 5", "Pipeline board", "Route protection")

**3. Increase card size to fit description (`src/lib/architectureFlow.ts`)**
- Increase `nodeHeight` from 72 → 100 to accommodate the extra text line
- Increase `nodeWidth` from 130 → 160 for better readability
- Adjust `nodeGap` if needed

### Files
| File | Change |
|---|---|
| `src/components/system-flow/ArchFlowNode.tsx` | Add accent background tint + left bar + description text |
| `src/lib/architectureFlow.ts` | Increase nodeWidth/nodeHeight for larger cards |

### Result
- Each layer has visually distinct colored cards (rose, orange, violet, blue, emerald, cyan)
- Every card shows its purpose in a single line description
- Architecture is immediately understandable at a glance

