

# Rename "General Report" to "Items" in Vizzy Brain Panel

## Change

### `src/components/vizzy/VizzyBrainPanel.tsx` (line 962)

Replace the header text:

```typescript
// Before:
<h3 className="text-base font-semibold text-foreground flex-1">General Report</h3>

// After:
<h3 className="text-base font-semibold text-foreground flex-1">Items</h3>
```

This renames the section to "Items" to better reflect that it shows the menu items each user has access to. The PDF button and accordion content remain unchanged.

| File | Change |
|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | Rename "General Report" → "Items" |

