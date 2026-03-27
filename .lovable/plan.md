

# Add "Brain Memory" Panel to Face ID Kiosk

## What
Add a brain icon button to the kiosk screen that opens a panel showing all enrolled faces (photos + names). This gives visibility into what the system has "learned" and allows admins to manage face enrollments directly from the kiosk.

## UI Design
- A **brain icon button** in the kiosk top area (next to "Exit Kiosk")
- Clicking it opens a **slide-out panel or modal** showing:
  - Each enrolled person's name + avatar
  - Their enrollment photos (thumbnails, up to 5)
  - Count of photos per person
  - A delete button to remove a person's enrollments if needed
- Panel can be dismissed to return to scanning

## Implementation

### 1. New component: `src/components/timeclock/FaceMemoryPanel.tsx`
- Fetches `face_enrollments` joined with `profiles` (name, avatar)
- Groups by profile, shows up to 5 photo thumbnails per person using signed URLs
- Displays enrollment count per person
- Delete button per person to clear their enrollments (calls `face_enrollments` delete)
- Uses a Sheet/Drawer UI pattern for mobile-friendly display

### 2. Update `src/pages/TimeClock.tsx` (kiosk mode section)
- Add `Brain` icon import from lucide-react
- Add state `showMemoryPanel` toggle
- Render brain button in the kiosk header area
- Render `<FaceMemoryPanel>` when `showMemoryPanel` is true

### 3. Signed URL generation
- Use `supabase.storage.from("face-enrollments").createSignedUrl()` client-side to display enrollment photos as thumbnails

## Files Changed
- **New**: `src/components/timeclock/FaceMemoryPanel.tsx`
- **Edit**: `src/pages/TimeClock.tsx` — add brain button + panel toggle in kiosk mode

