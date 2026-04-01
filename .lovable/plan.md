

# Collapse Production Queue Items by Default

## Change
Set all collapsible sections in `ShopFloorProductionQueue.tsx` to start **closed** (`false`) instead of **open** (`true`).

### File: `src/components/shopfloor/ShopFloorProductionQueue.tsx`
- **Line 193**: `useState(true)` → `useState(false)` (CustomerGroup)
- **Line 228**: `useState(true)` → `useState(false)` (ProjectGroup)

This gives the collapsed view shown in screenshot #1 (all customers listed but not expanded) as the default.

