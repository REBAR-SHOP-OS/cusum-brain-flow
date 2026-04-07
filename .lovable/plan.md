

# Expand Architecture Flow Tests — Full Coverage

## What's Missing

The test file has only 2 layout tests. The architecture now has 77 nodes, 107 edges, and a `resolveLayer` fallback. Critical invariants are untested.

## New Tests to Add

### File: `src/lib/architectureFlow.test.ts`

**Add 6 new test cases:**

1. **`resolveLayer` fallback** — verify that items with `layer` nested inside `data.layer` (React Flow format) get positioned correctly, same as top-level `layer`

2. **`matchesArchitectureQuery` filtering** — test label match, hint match, empty query (returns true), and no-match case

3. **Large layer wrapping (25+ nodes)** — verify the platform layer with 25 nodes wraps into 3 rows, and nodes in row 3 have higher y than row 1

### File: `src/lib/architectureGraphData.test.ts` (NEW)

**Add 4 graph integrity tests:**

4. **No duplicate node IDs** — `ARCH_NODES` should have all unique IDs

5. **No duplicate edge IDs** — `ARCH_EDGES` should have all unique IDs

6. **All edge sources/targets reference valid nodes** — every `source` and `target` in `ARCH_EDGES` must exist in `ARCH_NODES`

7. **All nodes have valid layers** — every node's `layer` must be one of the 7 defined layer keys

## Technical Details

- New file `architectureGraphData.test.ts` imports `ARCH_NODES`, `ARCH_EDGES`, `LAYERS` directly
- Uses `vitest` (`describe`, `it`, `expect`) consistent with existing test style
- Graph integrity tests are pure data validation — no DOM or React needed
- Layout tests extend the existing file with 3 more `it()` blocks

## Impact
- 2 test files total (1 existing expanded, 1 new)
- No production code changes
- Catches silent breakage from typos in node/edge IDs going forward

