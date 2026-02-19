

# Remove "OFFICE" Card from Shop Floor Hub

## What's Changing
Remove the "OFFICE" hub card from the `/shop-floor` page. Currently it's the first card in the grid, linking to `/office`. Since this is a Shop Floor interface, having an "Office" shortcut here is out of place.

## Technical Details

**File: `src/pages/ShopFloor.tsx`**

Remove the first entry from the `hubCards` array (lines 23-27):

```tsx
// REMOVE this entry:
{
  label: "OFFICE",
  icon: <LayoutGrid className="w-7 h-7" />,
  to: "/office",
},
```

Also remove the unused `LayoutGrid` import from lucide-react since it's only used by that card.

| File | Change |
|---|---|
| `src/pages/ShopFloor.tsx` | Remove "OFFICE" card from `hubCards` array; remove unused `LayoutGrid` import |

