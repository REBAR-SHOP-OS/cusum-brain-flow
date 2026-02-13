

# Audit and Improve: Clearance Station

## Issues Found

### 1. Critical: Flag Button is a No-Op
The "Flag for review" button (ClearanceCard.tsx line 209-211) only fires a toast notification. Nothing is persisted to the database. The `clearance_evidence` table has a `notes` column and `status` column that could hold a `flagged` state, but neither is used.

### 2. Critical: No File Size Validation on Photo Uploads
`handleUpload` accepts files of any size. A workshop user on mobile could upload a 50MB+ photo that will fail or time out, with no early warning.

### 3. Bug: Verify Without Evidence Should Be Blocked
`handleVerify` allows marking an item as "cleared" even when no photos have been uploaded (both `material_photo_url` and `tag_scan_url` are null). This defeats the purpose of an evidence-collection QC gate.

### 4. Missing: Error State Not Displayed
`useClearanceData` returns an `error` field, but `ClearanceStation.tsx` never uses it. If the query fails, users see an empty page with no explanation.

### 5. Missing: No `company_id` Filter on Query
The `useClearanceData` hook queries `cut_plan_items` without a `company_id` filter — a multi-tenant data leak risk (same pattern fixed in Deliveries).

### 6. Code Quality: `as any` Casts Throughout
All Supabase calls in ClearanceCard use `as any` type casts, bypassing TypeScript safety. The types file shows proper typed fields exist for `clearance_evidence`.

### 7. UX: No Photo Preview / Expand
Uploaded photos render at thumbnail size (aspect 4:3 in a grid). There is no way to tap and view a full-size image — important for QC review on mobile.

---

## Plan

### Fix 1: Persist Flag Action
- Update `ClearanceCard` flag button to set `status = 'flagged'` on the `clearance_evidence` record (insert if none exists)
- Optionally prompt for a short note using the existing `notes` column
- Show flagged state visually on the card (amber border + icon)

### Fix 2: File Size Validation (10MB limit)
- Add `MAX_FILE_SIZE = 10 * 1024 * 1024` constant
- Check in `handleUpload` before starting the upload; show destructive toast if exceeded

### Fix 3: Block Verify Without Evidence
- Disable "Manual Verify" button unless at least `material_photo_url` is present (from signedUrls state)
- Show a tooltip: "Upload material photo before verifying"

### Fix 4: Show Error State
- Destructure `error` from `useClearanceData()` in `ClearanceStation.tsx`
- Render an error message with retry button when `error` is truthy

### Fix 5: Add `company_id` Filter
- Import and use `useCompanyId` hook in `useClearanceData`
- Join through `cut_plans` which should carry `company_id`, or filter via the user's profile company

### Fix 6: Remove `as any` Casts
- Use proper typed objects for all `clearance_evidence` insert/update calls — the types already support `status`, `verified_by`, `verified_at`, `material_photo_url`, `tag_scan_url`, `notes`

### Fix 7: Fullscreen Photo Preview
- Add a lightweight image preview modal (click thumbnail to expand)
- Use existing Dialog component from the UI library

---

## Technical Details

### Files Modified
- `src/hooks/useClearanceData.ts` — company_id filter, expose `error`
- `src/components/clearance/ClearanceCard.tsx` — all other fixes
- `src/pages/ClearanceStation.tsx` — error state display

### ClearanceCard.tsx Changes

**File size check** (inside `handleUpload`):
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024;
if (file.size > MAX_FILE_SIZE) {
  toast({ title: "File too large", description: "Max 10MB per photo.", variant: "destructive" });
  return;
}
```

**Persist flag action** (replace toast-only handler):
```typescript
const handleFlag = async () => {
  if (!canWrite) return;
  try {
    if (item.evidence_id) {
      await supabase.from("clearance_evidence")
        .update({ status: "flagged" }).eq("id", item.evidence_id);
    } else {
      await supabase.from("clearance_evidence")
        .insert({ cut_plan_item_id: item.id, status: "flagged" });
    }
    await queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
    toast({ title: "Flagged", description: `${item.mark_number || "Item"} flagged for review` });
  } catch (err: any) {
    toast({ title: "Error", description: err.message, variant: "destructive" });
  }
};
```

**Block verify without evidence**:
```typescript
const hasEvidence = !!signedUrls.material;
// In button:
disabled={!canWrite || isCleared || verifying || !hasEvidence}
```

**Remove `as any` casts** — all insert/update objects already match the typed schema, so the casts can simply be removed.

**Photo preview** — add state `previewUrl` and a Dialog that shows the full image on click.

### useClearanceData.ts Changes

**Company filter**:
```typescript
import { useCompanyId } from "@/hooks/useCompanyId";

// Inside hook:
const companyId = useCompanyId();

// In query:
const { data: items } = await supabase
  .from("cut_plan_items")
  .select("*, cut_plans!inner(id, name, project_name, company_id)")
  .eq("phase", "clearance")
  .eq("cut_plans.company_id", companyId);
```

### ClearanceStation.tsx Changes

**Error display**:
```typescript
const { byProject, clearedCount, totalCount, isLoading, error } = useClearanceData();

// Before content:
if (error) {
  return (
    <div className="text-center py-20 text-destructive">
      <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-60" />
      <p className="text-sm">Failed to load clearance data</p>
      <Button variant="outline" size="sm" className="mt-3"
        onClick={() => window.location.reload()}>
        Retry
      </Button>
    </div>
  );
}
```

