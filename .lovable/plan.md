

# Audit and Improve: Evidence Flow, Loading Evidence, and Packing Slip Signed Archives

## Issues Found

### 1. Packing Slips View Shows "No deliveries found" (Screenshot Issue)
The `PackingSlipsView` queries the `deliveries` table, which has **0 rows**. The view is dead -- it's an empty shell. However, there ARE 74 completed items and 14 clearance items with actual evidence in `clearance_evidence`. The "Digital Archives" view should be pulling from **completed production items with clearance evidence** and **signed POD records**, not from an empty `deliveries` table.

### 2. No Link Between Production Evidence and Packing Slips
The clearance evidence (material photos, tag scans, verification records) exists in `clearance_evidence` but is never surfaced in the Packing Slips archive. The archive should show completed bundles grouped by project with their QC evidence attached.

### 3. Loading Evidence Has No Dedicated View
There's no "Loading Evidence" capture -- the system tracks `clearance_evidence` for QC photos but has no step for capturing loading photos (material being loaded onto trucks). The POD capture in `PODCaptureDialog` only fires at delivery stops, not at the warehouse loading dock.

### 4. Signed Packing Slips Not Archived
The `PODCaptureDialog` captures signatures and photos at delivery stops, but these are stored as raw fields (`pod_signature`, `pod_photo_url`) on `delivery_stops`. There's no archive view to browse signed packing slips with their POD evidence.

### 5. Order QC Evidence Flag is Manual Only
`qc_evidence_uploaded` on orders is a manual checkbox in `OrderDetail`. It's never automatically set when clearance evidence is actually uploaded for that order's items.

---

## Plan

### 1. Rewrite PackingSlipsView Data Source
Instead of querying the empty `deliveries` table, query `cut_plan_items` where `phase = 'complete'`, joined with `clearance_evidence` and grouped by project. This surfaces the 74+ completed items with their QC evidence.

**Data flow:**
- Query `cut_plan_items` with `phase = 'complete'` joined to `cut_plans` (for project name) and `clearance_evidence` (for photos/verification)
- Group by project name
- Show each project as a card with: item count, cleared count, evidence photo count, verification timestamps

### 2. Add Evidence Gallery to Archive Cards
When clicking "View Details" on a project card, expand or navigate to show:
- Grid of clearance evidence photos (material + tag scans) with signed URLs
- Verification status and who verified each item
- Timestamp of verification

### 3. Add Loading Evidence Capture
Create a "Loading Evidence" section that allows warehouse staff to capture photos of bundles being loaded. This uses the existing `clearance-photos` storage bucket.

- Add a `loading_evidence` table with: `id`, `cut_plan_id`, `project_id`, `photo_url`, `notes`, `captured_by`, `captured_at`
- Add a "Capture Loading Photo" button in the archive detail view for items that are complete but not yet on a delivery

### 4. Surface Signed POD in Archives
Even though `delivery_stops` is currently empty, wire up the archive to also show any delivery stops that have POD signatures/photos when deliveries exist. Add a "Signed Deliveries" tab/section alongside the production evidence section.

### 5. Fix the View Details Button
Currently the "View Details" button on each card does nothing (no `onClick`). Wire it to expand a detail panel showing all evidence for that project.

---

## Technical Details

### File: `src/components/office/PackingSlipsView.tsx` -- Complete Rewrite

**Replace the `deliveries` query** with completed items + evidence:

```typescript
// Query completed items grouped by project
const { data: completedProjects = [], isLoading } = useQuery({
  queryKey: ["archive-completed-projects"],
  queryFn: async () => {
    const { data: items, error } = await supabase
      .from("cut_plan_items")
      .select("*, cut_plans!inner(id, name, project_name), clearance_evidence(id, material_photo_url, tag_scan_url, status, verified_at, verified_by)")
      .eq("phase", "complete");
    if (error) throw error;
    // Group by project
    const byProject = new Map();
    for (const item of items || []) {
      const key = item.cut_plans?.project_name || item.cut_plans?.name || "Unassigned";
      if (!byProject.has(key)) byProject.set(key, { name: key, items: [], evidenceCount: 0, clearedCount: 0 });
      const proj = byProject.get(key);
      proj.items.push(item);
      const ev = item.clearance_evidence?.[0];
      if (ev) {
        proj.evidenceCount++;
        if (ev.status === "cleared") proj.clearedCount++;
      }
    }
    return [...byProject.values()];
  },
});
```

**Add detail panel** with evidence gallery when a project is selected:
- Show each item's mark number, bar code, clearance photos
- Use signed URLs from `clearance-photos` bucket (same pattern as `ClearanceCard`)
- Show verification badge and timestamp

**Add "Signed Deliveries" section** that queries `delivery_stops` with POD data (ready for when deliveries are created).

### Database Migration: `loading_evidence` Table

```sql
CREATE TABLE IF NOT EXISTS public.loading_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cut_plan_id uuid REFERENCES public.cut_plans(id),
  project_id uuid REFERENCES public.projects(id),
  company_id uuid REFERENCES public.companies(id),
  photo_url text NOT NULL,
  notes text,
  captured_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.loading_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view loading evidence for their company"
  ON public.loading_evidence FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert loading evidence for their company"
  ON public.loading_evidence FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
```

### File: `src/components/office/PackingSlipsView.tsx` -- Loading Evidence Capture

Add a photo upload button in the detail view that:
1. Opens camera/file picker
2. Uploads to `clearance-photos` bucket under `loading/` prefix
3. Inserts record into `loading_evidence`
4. Shows loading photos alongside clearance evidence

### Files Modified
- `src/components/office/PackingSlipsView.tsx` -- rewrite data source from deliveries to completed production items + evidence gallery + loading evidence + signed POD section
- Database migration -- `loading_evidence` table for warehouse loading photos

