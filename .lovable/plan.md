

# Add Individual Photo Deletion to Face Memory Panel

## Problem
Currently the Face Memory panel only allows deleting ALL photos for a person (the trash icon per profile). The user wants the ability to delete individual photos one at a time.

## Fix

**File:** `src/components/timeclock/FaceMemoryPanel.tsx`

1. **Add `handleDeleteSingle` function** — soft-deletes a single enrollment by setting `is_active = false`, then re-fetches data.

2. **Add delete overlay on each photo thumbnail** (lines 406-423) — show a small red X button on hover/tap over each photo. Clicking it calls `handleDeleteSingle(enrollment.id)`.

### Changes

**New function** (after `handleDeleteAll`, ~line 235):
```typescript
const handleDeleteSingle = async (enrollmentId: string) => {
  const { error } = await supabase
    .from("face_enrollments")
    .update({ is_active: false })
    .eq("id", enrollmentId);
  if (error) toast.error("Failed to delete photo");
  else { toast.success("Photo removed"); fetchData(); }
};
```

**Photo thumbnail** (lines 408-422): Wrap each photo in a `relative group` div, add a small absolute-positioned delete button that appears on hover:
```tsx
<button onClick={() => handleDeleteSingle(enrollment.id)}
  className="absolute top-0 right-0 ... opacity-0 group-hover:opacity-100">
  <X className="w-3 h-3" />
</button>
```

## Files Changed
- `src/components/timeclock/FaceMemoryPanel.tsx` — add single-photo delete handler + overlay button on thumbnails

