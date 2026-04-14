

## Plan: Horizontal Layout + Remove Duplicate Cards + Layer 1.5

### Problem
1. The layout is currently vertical (top-to-bottom) — user wants **horizontal** (left-to-right)
2. Four cards have duplicate labels across layers: **Stripe**, **RingCentral**, **Odoo**, **QuickBooks** (each appears in both Integrations and External Services)
3. User wants a layer 1.5 between External Services and AI/Automation for sidebar "items"
4. Zoom/pan/drag already works via ReactFlow — no changes needed there

### Current Duplicates
| Label | Integration Layer (id) | External Layer (id) |
|---|---|---|
| Stripe | fn-stripe | ext-stripe |
| RingCentral | fn-ring | ext-rc |
| Odoo | fn-odoo | ext-odoo |
| QuickBooks | fn-qb | ext-qb |

### Changes

**1. `src/lib/architectureFlow.ts` — Switch to horizontal layout**
- Change the layout algorithm so layers are arranged **left-to-right** (each layer = a column) instead of top-to-bottom (each layer = a row)
- Layers become vertical columns; nodes within each layer stack vertically
- Swap X/Y logic: `layerOffset` controls X position, nodes within a layer get sequential Y positions
- Adjust constants: `layerGap` → horizontal spacing between columns, `nodeGap` → vertical spacing within columns

**2. `src/lib/architectureGraphData.ts` — Fix duplicates + add layer 1.5**
- Rename duplicate labels to be distinct:
  - `fn-stripe` → "Stripe API" (or keep as integration-specific name)
  - `fn-ring` → "RC API"
  - `fn-odoo` → "Odoo Sync"
  - `fn-qb` → "QB Sync"
- Add a new layer key `"items"` between `external` and `ai` in the `LAYERS` array for sidebar menu items (layer 1.5)
- Move the 24 Business Module nodes into this new `items` layer, or create it as a distinct grouping depending on user's intent

**3. `src/lib/architectureGraphData.ts` — Update type + LAYERS**
- Add `"items"` to `ArchLayer` type
- Insert `{ key: "items", label: "System Items", accent: "orange", y: 1 }` into LAYERS between external (y:0) and ai (y:2)
- Re-number subsequent layer `y` values

**4. `src/pages/Architecture.tsx` — Ensure horizontal scroll**
- The ReactFlow canvas already supports pan/zoom/drag — no changes needed for that
- Verify `fitView` works well with wider horizontal layouts

**5. `src/lib/architectureFlow.test.ts` — Update tests**
- Adjust layout tests for the new horizontal algorithm (X increases per layer instead of Y)

### Result
- Architecture flows **left → right**: External Services → Items → AI/Agents → Modules → Integrations → Access → Entry → Platform
- No duplicate card names
- Full zoom, pan, and drag preserved
- All 108 nodes and their connections intact

