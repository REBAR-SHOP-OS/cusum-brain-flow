

# Audit and Improve: Initialize Manifest Form

## Issues Found

### 1. Bug: Customer List Never Refreshes After Adding
Line 186 invalidates query key `"erp-contacts"` but the actual query uses key `"erp-contacts-all"` (line 132). After adding a new customer, the dropdown never updates until a full page reload.

### 2. No Form Validation Before Extraction
The "Extract and Map" button is only disabled when `!profile?.company_id`. Users can trigger extraction with no manifest name, no customer, no project selected -- the form has zero required-field enforcement.

### 3. Layout Mismatch
The form grid uses `lg:grid-cols-4` (line 842), cramming all 4 fields into one row on large screens. The screenshot shows a cleaner 2-column layout (Manifest Name + Customer, Site Address + Target ETA). Should be `grid-cols-2`.

### 4. Project Delete Uses Browser `confirm()`
Lines 710 and 734 use `confirm()` for project deletion -- inconsistent with the rest of the app which uses AlertDialog. Also, deleting a project inline in a dropdown is risky with no undo.

### 5. No Loading/Empty States on Selectors
Project and barlist dropdowns show no loading indicator while data is fetching. If the user has no projects, there is no helpful empty state.

### 6. File Size Not Validated
Any file of any size is accepted. Large files (over 20MB) will fail on upload but the user gets no early warning.

---

## Plan

### Fix 1: Customer Query Invalidation Bug
Change line 186 from `["erp-contacts"]` to `["erp-contacts-all"]`.

### Fix 2: Add Form Validation
- Disable "Extract and Map" unless manifest name is filled and either a project is selected or a new project name is entered
- Show subtle required indicators on Manifest Name field
- Add file size check (reject files over 20MB with a toast)

### Fix 3: Fix Layout to 2-Column Grid
Change `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` to `grid-cols-1 sm:grid-cols-2` for the manifest name / customer / site address / target ETA row.

### Fix 4: Replace `confirm()` with AlertDialog for Project Delete
Replace the inline `confirm()` calls with proper AlertDialog pattern, consistent with the rest of the app.

### Fix 5: Add Loading State to Project Selector
Show a spinner or "Loading projects..." in the command list while projects are loading.

### Fix 6: File Size Validation
In `handleFileSelect` and `handleDrop`, reject files over 20MB with a toast warning.

---

## Technical Details

### File: `src/components/office/AIExtractView.tsx`

**Query key fix** (line 186):
```typescript
// Before:
await queryClient.invalidateQueries({ queryKey: ["erp-contacts"] });
// After:
await queryClient.invalidateQueries({ queryKey: ["erp-contacts-all"] });
```

**Layout fix** (line 842):
```typescript
// Before:
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
// After:
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

**File size validation** (in `handleFileSelect` and `handleDrop`):
```typescript
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
if (file.size > MAX_FILE_SIZE) {
  toast({ title: "File too large", description: "Maximum file size is 20MB.", variant: "destructive" });
  return;
}
```

**Extract button validation**:
```typescript
const canExtract = !!uploadedFile && !!profile?.company_id && 
  (!!manifestName.trim()) && 
  (!!selectedProjectId || (createNewProject && !!newProjectName.trim()));

<Button onClick={handleExtract} disabled={!canExtract}>
```

**Replace `confirm()` with AlertDialog** for project deletion (lines 708-716, 730-740):
- Add state for delete confirmation dialog
- Use the existing AlertDialog components already imported in the file
- Show project name in the confirmation message

### Files Modified
- `src/components/office/AIExtractView.tsx` -- all fixes in this single file

