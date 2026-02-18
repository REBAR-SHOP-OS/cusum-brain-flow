
# Fix Upload Wiring in Lead Chatter + Add Project Timelines

## Issues Identified

### Issue 1: Attach Button is Dead (OdooChatter.tsx)
The "Attach" button in the Chatter composer (line 278) is a plain `<Button>` with NO `onClick` handler, no file input, no upload logic. It renders but does nothing -- exactly what the red circle in the screenshot highlights.

### Issue 2: No Timeline View on Projects
The Project Management view (`ProjectManagement.tsx`) has a Kanban board and Gantt chart for tasks, but no activity/event timeline (like the Odoo chatter timeline shown in the second screenshot). Projects don't track who did what and when in a chronological feed.

---

## Fix 1: Wire the Attach Button in OdooChatter

**File: `src/components/pipeline/OdooChatter.tsx`**

Add file upload capability to the Chatter composer:

1. Add a hidden `<input type="file">` ref
2. Wire the Attach button's `onClick` to trigger the file input
3. On file selection:
   - Upload to `clearance-photos` bucket under `lead-attachments/{leadId}/{timestamp}-{filename}` (matches existing upload pattern across the app)
   - Insert a row into `lead_files` with `storage_path`, `file_name`, `mime_type`, `file_size_bytes`, `source: "chatter_upload"`, `lead_id`, `company_id`
   - Invalidate `lead-files-timeline` query so the file appears instantly in the thread
4. Add guards: throttle (prevent double-clicks), file size limit (20MB), type validation
5. Show upload progress via a small preview strip with a spinner (similar to WebsiteChat pattern)
6. Accept images, PDFs, and common document types

**Changes are surgical**: Only touches the OdooChatter component. The `lead_files` table and `clearance-photos` bucket already exist. The timeline thread already renders files from `lead_files` -- so once inserted, they appear automatically.

---

## Fix 2: Add Activity Timeline to Each Project

**Database: New table `project_events`**

```
project_events
- id (uuid, PK)
- company_id (uuid, NOT NULL)
- project_id (uuid, FK -> projects)
- event_type (text): "task_created", "task_completed", "status_changed", "note", "file_attached", "milestone_reached"
- title (text)
- description (text, nullable)
- created_by (text): user name or "System"
- metadata (jsonb)
- created_at (timestamptz, default now())
```

With RLS: company members can read/insert for their own company.

**Trigger: Auto-log task changes**

Create a database trigger on `project_tasks` that logs to `project_events` when:
- A new task is created (event_type: "task_created")
- A task status changes (event_type: "status_changed", old -> new in metadata)
- A task is completed (event_type: "task_completed")

**New component: `ProjectTimeline.tsx`**

A timeline feed component (following the OdooChatter/LeadTimeline pattern) showing:
- Chronological list of project events grouped by date separators
- Icons per event type (same icon map pattern as LeadTimeline)
- Author avatars with initials
- "Log note" composer at the top for manual entries

**Wire into ProjectManagement.tsx**

Add a "Timeline" tab alongside existing "Kanban" and "Gantt" tabs. When a project is selected, show its timeline. When no project is selected, show a unified timeline across all projects.

---

## Technical Details

### OdooChatter Upload Logic
```typescript
// New state
const [uploadingFile, setUploadingFile] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);

// Upload handler with guards
const handleAttach = async (file: File) => {
  if (uploadingFile) return; // throttle
  if (file.size > 20 * 1024 * 1024) { toast error; return; }
  setUploadingFile(true);
  try {
    const path = `lead-attachments/${lead.id}/${Date.now()}-${file.name}`;
    await supabase.storage.from("clearance-photos").upload(path, file);
    await supabase.from("lead_files").insert({
      lead_id: lead.id,
      company_id: lead.company_id,
      file_name: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      storage_path: path,
      source: "chatter_upload",
    });
    queryClient.invalidateQueries({ queryKey: ["lead-files-timeline", lead.id] });
    toast({ title: "File attached" });
  } catch { toast error; }
  finally { setUploadingFile(false); }
};
```

### Project Events Table Schema
- RLS: `USING (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid()))`
- Trigger on `project_tasks` for INSERT and UPDATE to auto-log events

### ProjectTimeline Component
- Follows exact same pattern as OdooChatter thread rendering
- Date separators, icon maps, author initials
- Note composer with the same Attach + Send pattern (also wired to upload)

---

## Files Changed

| File | Action | What |
|------|--------|------|
| `src/components/pipeline/OdooChatter.tsx` | Edit | Wire Attach button with file input, upload logic, guards |
| `src/components/accounting/ProjectTimeline.tsx` | New | Timeline feed component for projects |
| `src/components/accounting/ProjectManagement.tsx` | Edit | Add "Timeline" tab |
| Database migration | New | Create `project_events` table + trigger on `project_tasks` |

No other files are touched. All changes are additive and use existing infrastructure (storage bucket, query patterns, UI components).
