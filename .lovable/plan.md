

# Add Photo Delete Button to Clearance Cards

## Problem
Once a photo is uploaded on the Clearance Station, there's no way to remove it without reloading the page.

## Fix

### 1. Add `onDelete` callback to `PhotoSlot` component
Add an `onDelete` prop and render a small X button overlay on the photo thumbnail (top-right corner). Only shown when `!disabled` and a URL exists.

### 2. Add `handleDeletePhoto` to `ClearanceCard`
New handler that:
1. Extracts the storage path from the `clearance_evidence` record (the stored value is already a path like `{itemId}/material-{ts}.jpg`)
2. Deletes the file from `clearance-photos` bucket via `supabase.storage.from("clearance-photos").remove([path])`
3. Updates the `clearance_evidence` row, setting `material_photo_url` or `tag_scan_url` to `null`
4. Invalidates the `clearance-items` query
5. Clears any `validationResult` state

### 3. Changes — single file: `src/components/clearance/ClearanceCard.tsx`

**PhotoSlot component** — add `onDelete` prop, render delete button:
```tsx
// New prop
onDelete?: () => void;

// In the rendered JSX, when url exists, add overlay button:
{url && !disabled && onDelete && (
  <button
    onClick={(e) => { e.stopPropagation(); onDelete(); }}
    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-destructive text-white z-10"
  >
    <XCircle className="w-4 h-4" />
  </button>
)}
```

**ClearanceCard component** — add delete handler, pass to PhotoSlot:
```tsx
const [deleting, setDeleting] = useState<"material" | "tag" | null>(null);

const handleDeletePhoto = async (type: "material" | "tag") => {
  if (!canWrite || !item.evidence_id) return;
  setDeleting(type);
  try {
    const field = type === "material" ? "material_photo_url" : "tag_scan_url";
    const storedPath = type === "material" ? item.material_photo_url : item.tag_scan_url;
    
    // Delete from storage
    if (storedPath) {
      let path = storedPath;
      const marker = "/object/public/clearance-photos/";
      const idx = storedPath.indexOf(marker);
      if (idx !== -1) path = storedPath.substring(idx + marker.length);
      await supabase.storage.from("clearance-photos").remove([path]);
    }
    
    // Clear DB field
    await supabase.from("clearance_evidence")
      .update({ [field]: null })
      .eq("id", item.evidence_id);
    
    setValidationResult(null);
    await queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
    toast({ title: `${type === "material" ? "Material" : "Tag"} photo removed` });
  } catch (err: any) {
    toast({ title: "Delete failed", description: err.message, variant: "destructive" });
  } finally {
    setDeleting(null);
  }
};
```

Pass `onDelete` to each `<PhotoSlot>`:
```tsx
onDelete={() => handleDeletePhoto("material")}
onDelete={() => handleDeletePhoto("tag")}
```

No database changes needed. Single-file change.

