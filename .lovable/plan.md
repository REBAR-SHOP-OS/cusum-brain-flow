

# Camera Management UI

## Overview
Add a `cameras` table to the database and a management UI panel within the Camera Intelligence dashboard, allowing registration and editing of Reolink cameras directly from the ERP.

## Database

New table `public.cameras`:
```sql
CREATE TABLE public.cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  camera_id text NOT NULL,          -- e.g. "cam_loading_dock"
  name text NOT NULL,               -- display name
  ip_address text NOT NULL,
  port integer DEFAULT 554,
  username text DEFAULT 'admin',
  password text,                    -- stored encrypted ideally, but functional for now
  rtsp_path text DEFAULT '/h264Preview_01_main',
  location text,                    -- e.g. "Loading Dock"
  assigned_zone text,               -- links to zone id
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: company-scoped
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own company cameras"
  ON public.cameras FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users insert own company cameras"
  ON public.cameras FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users update own company cameras"
  ON public.cameras FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users delete own company cameras"
  ON public.cameras FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
```

## Frontend Changes

### 1. New component: `src/components/camera/CameraManager.tsx`
- Table listing all registered cameras (name, IP, location, zone, active status)
- "Add Camera" button opens a dialog form with fields: Name, Camera ID, IP Address, Port, Username, Password, RTSP Path, Location, Zone (dropdown of ZONES), Active toggle
- Edit and Delete actions per row
- Uses react-hook-form + zod validation

### 2. Modify: `src/pages/CameraIntelligence.tsx`
- Add a "Cameras" tab/section at the top (using Tabs or a toggle button) alongside existing dashboard
- Import and render `CameraManager` in a new panel
- Add a Settings/Camera icon button in the header to toggle the management view

## Files
- **Create**: `src/components/camera/CameraManager.tsx`
- **Modify**: `src/pages/CameraIntelligence.tsx` (add camera management toggle)
- **Migration**: 1 (cameras table + RLS)

