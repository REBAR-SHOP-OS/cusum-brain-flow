

# Add Length Unit Selector to Bar List Column Mapping

## Problem
The "Cut Length (mm)" field in the mapping panel has no option to change the unit. Users working with data in feet, inches, or meters cannot convert their length values during mapping.

## Solution
Add a unit dropdown next to the "Cut Length" mapping field. When a non-mm unit is selected, all length values are automatically converted to mm during mapping confirmation and preview.

### Supported Units
| Unit | Conversion to mm |
|------|-----------------|
| mm (default) | ×1 |
| cm | ×10 |
| m | ×1000 |
| inches | ×25.4 |
| feet | ×304.8 |

### Changes to `src/components/office/BarlistMappingPanel.tsx`

1. **Add state**: `lengthUnit` state (default: `"mm"`)
2. **Add unit dropdown**: Render a small `<Select>` next to the Cut Length mapping row — visually paired with the existing column selector
3. **Update label dynamically**: Change "Cut Length (mm)" label to reflect selected unit, e.g. "Cut Length (ft)"
4. **Apply conversion in preview and confirm**: Multiply the raw length value by the conversion factor when building `MappedRow[]` (both `previewRows` and `handleConfirm`)

The conversion happens client-side at mapping time — the database always stores mm. No backend changes needed.

