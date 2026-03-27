

# Fix Face Memory Panel + Add Manual Enrollment

## Problem
The Face Memory panel shows "0 people enrolled" despite 20+ enrollments in the database across 6 profiles.

## Root Cause
**RLS policy on `face_enrollments`** only allows users to see their own enrollments. The kiosk user (`ai@rebar.shop`, user_id `b2b75b2e-...`) is NOT in the admin role, so the admin policy also fails. Result: 0 rows returned client-side.

The database confirms 20 active enrollments across 6 people (Ai, Neel, Sattar, Zahra, Saurabh, Radin).

## Fixes

### 1. Database: Add kiosk user to admin role
Insert the "Ai" kiosk user (`b2b75b2e-4ebb-4779-afc0-c04cbb010112`) into `user_roles` with `admin` role. This allows the kiosk account to see all enrollments via the existing "Admins can view all face enrollments" policy.

### 2. Feature: Manual enrollment form in FaceMemoryPanel
Add an "Add Person" button at the top of the panel that opens an inline form:
- **Profile selector**: Dropdown of all company profiles (from `profiles` table)
- **Camera capture**: Start camera, capture 3 photos (front, left, right) — reuse the same pattern from `FaceEnrollment.tsx`
- **Upload + save**: Upload photos to `face-enrollments` storage bucket, insert into `face_enrollments` table
- After save, refresh the panel data

### 3. UI layout
- "Add Person" button in the panel header next to the stats
- Inline capture form replaces the list temporarily while adding
- 3-step capture flow with face guide overlay (same as existing enrollment)

## Files Changed
- **Database migration**: Insert admin role for kiosk user
- **`src/components/timeclock/FaceMemoryPanel.tsx`**: Add manual enrollment form with camera capture, profile selector, and upload logic

