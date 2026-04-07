

# Fix: Architecture Diagram Build Errors + Broken Layout

## Root Cause

`applyArchitectureLayout` requires `{ id, layer, ... }` at the top level (`ArchitectureLayoutItem`). But `ArchitectureFlowNode` (React Flow Node) has `layer` inside `data`, not at the top level. This causes:
1. **Build errors** — type mismatch when passing nodes to `applyArchitectureLayout`
2. **Broken layout** — nodes don't get positioned correctly, everything piles up

## Fix

### File: `src/lib/architectureFlow.ts`

Update `applyArchitectureLayout` to accept items where `layer` can be either at the top level OR inside `data.layer`. This makes it compatible with both raw layout items AND React Flow nodes.

Change the generic constraint:
```typescript
export function applyArchitectureLayout<T extends { id: string; layer?: ArchLayer; data?: { layer?: ArchLayer } }>(items: T[]): T[]
```

Inside the function, resolve layer via: `item.layer || item.data?.layer`

### File: `src/pages/Architecture.tsx`

Three fixes:

1. **Line 84**: Add `layer` to mapped objects passed to `applyArchitectureLayout`:
```typescript
ARCH_NODES.map((node) => ({
  id: node.id,
  layer: node.layer,  // ADD THIS
  type: "archNode",
  ...
}))
```

2. **Line 226**: Same fix for delete handler — extract `layer` from `data` before passing:
```typescript
setNodes((nds) => applyArchitectureLayout(
  nds.filter((n) => n.id !== nodeId).map(n => ({ ...n, layer: n.data.layer }))
) as ArchitectureFlowNode[]);
```

3. **Line 306**: Same fix for add node handler.

### File: `src/lib/architectureFlow.test.ts`

Update test items to include a `position` property in the type assertion or use type casting, since the function now returns items with position set.

## Impact
- Fixes all 10+ build errors
- Fixes the broken visual layout (nodes will be properly positioned in 7 layers)
- No data, edge, or interaction changes

