

# Storyboard Download + Ad Project History & Video Library

## What We're Building

1. **Download button on each completed scene clip** in the storyboard
2. **Ad project history table** (`ad_projects`) to persist every Ad Director session
3. **Auto-save completed scene clips** to the `generated-videos` storage bucket so they appear in the existing Video Library

## Implementation

### 1. Scene Card Download Button
**File: `src/components/ad-director/SceneCard.tsx`**
- Add a `Download` icon button next to the Regenerate button when `clip.status === "completed"`
- Use `downloadFile()` from `src/lib/downloadUtils.ts` to handle cross-origin downloads
- Filename format: `scene-{index+1}-{segmentLabel}.mp4`

### 2. Database: `ad_projects` History Table
New migration:
```sql
CREATE TABLE public.ad_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled Ad',
  brand_name text,
  script text,
  segments jsonb DEFAULT '[]',
  storyboard jsonb DEFAULT '[]',
  clips jsonb DEFAULT '[]',
  continuity jsonb,
  final_video_url text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.ad_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ad projects"
  ON public.ad_projects FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

### 3. Auto-Save Clips to Video Library
**File: `src/components/ad-director/AdDirectorContent.tsx`**
- When a scene clip completes (status → `completed` with a `videoUrl`), auto-upload it to `generated-videos/{userId}/{uuid}.mp4` via `supabase.storage`
- Replace the clip's external CDN URL with the permanent storage URL
- This makes all generated clips appear in the existing `VideoLibrary` component

### 4. Project History Hook
**File: `src/hooks/useAdProjectHistory.ts`** (new)
- `saveProject()` — upserts current project state to `ad_projects`
- `loadProjects()` — fetches user's past projects ordered by `updated_at desc`
- `loadProject(id)` — loads a specific project and restores all state
- `deleteProject(id)`

### 5. History UI in Script Input
**File: `src/components/ad-director/ScriptInput.tsx`**
- Add a "History" section showing past projects as clickable cards (name, date, status badge)
- Clicking loads the project back into the director
- Delete button per project

### 6. Auto-Save on Key Events
**File: `src/components/ad-director/AdDirectorContent.tsx`**
- Auto-save project after analysis completes (storyboard created)
- Auto-save after all scenes finish generating
- Auto-save after final export
- Pass `onLoadProject` to ScriptInput to restore saved projects

## Files Modified
1. **New migration** — `ad_projects` table + RLS
2. **`src/components/ad-director/SceneCard.tsx`** — Add download button for completed clips
3. **`src/hooks/useAdProjectHistory.ts`** (new) — CRUD hook for ad projects
4. **`src/components/ad-director/AdDirectorContent.tsx`** — Auto-save clips to storage, auto-save project state, restore from history
5. **`src/components/ad-director/ScriptInput.tsx`** — Add project history list UI

