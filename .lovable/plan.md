
# Final Execution Prompt — Add Delete Button for Draft Packing Slips on /deliveries

## Scope Lock

- File: `src/pages/Deliveries.tsx` ONLY
- Section: The Packing Slip card (`TabsContent value="slips"`) — lines 325–366
- Component: The `Card` element rendered inside `packingSlips.map()`
- Do NOT touch: DeliveryList, DeliveryCard, StopCard, StatCard, Detail Panel, Tabs structure, navigation, layout, styles, or any other logic

## Problem Description

In the "Slips" tab on the `/deliveries` page, each packing slip card shows a `Badge` with its status (e.g., "draft", "delivered", "archived"). There is currently no way to delete a packing slip that is in **draft** status. A small Delete button must appear next to the status badge — only when `slip.status === "draft"`.

## Minimal Fix Steps

**Step 1 — Add `Trash2` to the lucide-react import** (line 17–31):

```tsx
import { 
  Truck, MapPin, Clock, CheckCircle2, AlertTriangle,
  Loader2, Plus, Calendar, User, ArrowLeft,
  Camera, FileWarning, FileText, Trash2   // <-- add Trash2
} from "lucide-react";
```

**Step 2 — Add `deletingSlipId` state** (after line 93):

```tsx
const [deletingSlipId, setDeletingSlipId] = useState<string | null>(null);
```

**Step 3 — Add `deleteSlip` function** (after the `refreshStops` function, around line 185):

```tsx
const deleteSlip = async (slipId: string, e: React.MouseEvent) => {
  e.stopPropagation(); // prevent card click / opening the slip
  setDeletingSlipId(slipId);
  const { error } = await supabase
    .from("packing_slips" as any)
    .delete()
    .eq("id", slipId)
    .eq("status", "draft"); // safety: only draft rows
  setDeletingSlipId(null);
  if (error) {
    toast.error("Failed to delete: " + error.message);
  } else {
    queryClient.invalidateQueries({ queryKey: ["packing-slips"] });
  }
};
```

**Step 4 — Modify the packing slip Card header** (lines 344–357):

Change the current `<div className="flex items-center justify-between mb-1">` to include a delete button next to the Badge, **only when status is draft**:

```tsx
<div className="flex items-center justify-between mb-1">
  <span className="font-medium flex items-center gap-2">
    <FileText className="w-4 h-4" />
    {slip.slip_number}
  </span>
  <div className="flex items-center gap-1.5">
    <Badge className={...existing className logic...}>
      {slip.status}
    </Badge>
    {slip.status === "draft" && (
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={(e) => deleteSlip(slip.id, e)}
        disabled={deletingSlipId === slip.id}
      >
        {deletingSlipId === slip.id
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <Trash2 className="w-3 h-3" />
        }
      </Button>
    )}
  </div>
</div>
```

**Step 5 — Add toast import check**

`toast` from `sonner` must be imported. Check line 1–32 of the file. If not already imported, add:
```tsx
import { toast } from "sonner";
```

## Acceptance Criteria

- [ ] Draft slips show a small red Trash2 icon button next to the "draft" badge
- [ ] Non-draft slips (delivered, archived) show NO delete button
- [ ] Clicking Delete does NOT open the packing slip overlay
- [ ] After deletion, the slip disappears from the list immediately (via query invalidation)
- [ ] While deletion is in progress, a spinner replaces the trash icon and button is disabled
- [ ] If deletion fails, a toast error is shown

## Testing Steps

1. Navigate to `/deliveries` → click "Slips" tab
2. Confirm draft slips have a red trash icon next to their status badge
3. Confirm delivered/archived slips have no delete button
4. Click trash icon on a draft slip → confirm it disappears without opening the slip overlay
5. Verify no other part of the page changed (tabs, delivery list, detail panel, header)

## Files Changed

| File | Change |
|---|---|
| `src/pages/Deliveries.tsx` | Add `Trash2` import, `deletingSlipId` state, `deleteSlip` function, delete button in slip card header |

No database migrations. No new tables. No other files touched.

## Rollback Method

If the change causes issues, remove:
1. `Trash2` from the lucide import
2. `deletingSlipId` state declaration
3. `deleteSlip` function
4. The `{slip.status === "draft" && (...)}` JSX block and revert the wrapping `<div>` to the original single Badge

The table data is unaffected unless a deletion was already confirmed by the user.
