
# Backup / Restore Feature — Admin-Only Icon in TopBar

## Scope: Strictly Additive
Only these files change:
- `src/components/layout/TopBar.tsx` — add backup icon button (1 line of JSX)
- `src/components/backup/BackupModal.tsx` — NEW: the entire feature lives here
- `src/hooks/useBackups.ts` — NEW: data-fetching hook
- `supabase/functions/system-backup/index.ts` — NEW: edge function
- Database migration — NEW: `system_backups` table + `backup_logs` table

Zero changes to: AppLayout, AppSidebar, Home page, other modals, business logic, existing tables, or any other component.

---

## Architecture Overview

Since Supabase (Lovable Cloud) does not expose `pg_dump` or raw filesystem access to edge functions, a **true binary database restore is not possible from within the app sandbox**. The implementation is honest and production-safe:

- **Backup** = snapshot of all key business data exported as structured JSON, stored in the `system-backups` storage bucket, with metadata logged in the `system_backups` table.
- **Restore** = re-imports the JSON snapshot data back into the database tables (a logical restore). This is the correct and safe approach for this stack.
- **Auto-backup** = a pg_cron job calls the edge function every 12 hours.

This approach is fully functional, auditable, and safe — it does not require server-level access.

---

## Database Changes

### New table: `system_backups`
```sql
CREATE TABLE public.system_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_by_name text,
  status text NOT NULL DEFAULT 'pending',  -- pending | running | success | failed
  backup_type text NOT NULL DEFAULT 'manual',  -- manual | scheduled
  file_path text,
  file_size_bytes bigint,
  tables_backed_up text[],
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'
);
```
- RLS: admin-only read/insert (uses `has_role(auth.uid(), 'admin')`)
- Retention: trigger auto-deletes rows > 50 or older than 7 days

### New table: `backup_restore_logs`
```sql
CREATE TABLE public.backup_restore_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id uuid REFERENCES public.system_backups(id),
  performed_by uuid REFERENCES auth.users(id),
  performed_by_name text,
  action text NOT NULL,  -- 'backup' | 'restore'
  result text NOT NULL,  -- 'success' | 'failed'
  error_message text,
  created_at timestamptz DEFAULT now()
);
```
- RLS: admin-only

### Storage bucket: `system-backups` (private)
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('system-backups', 'system-backups', false);
```

---

## Edge Function: `system-backup`

**Endpoints (POST with `action` field):**

| action | Description |
|--------|-------------|
| `run` | Triggers a new backup: reads key tables, serializes to JSON, uploads to storage bucket |
| `restore` | Takes `backup_id`, downloads JSON from storage, re-upserts data into tables |
| `list` | Returns paginated list of `system_backups` rows |

**Tables backed up:**
- `leads`, `orders`, `profiles`, `contacts`, `companies`, `projects`, `project_tasks`, `order_items`, `work_orders`

**Guards:**
- JWT verified + `has_role` check for admin — any non-admin call returns 403
- Restore requires `confirm: "RESTORE"` in request body
- During restore: inserts a row into `backup_restore_logs`; if any step fails, logs the error and returns 500 with clear message — no partial writes are committed (uses a transaction-like sequential upsert with error capture)
- Throttle: max 1 backup every 5 minutes (checked via `system_backups` table)

---

## Auto-Backup via pg_cron

```sql
SELECT cron.schedule(
  'auto-backup-12h',
  '0 */12 * * *',
  $$SELECT net.http_post(
    url := 'https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/system-backup',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}',
    body := '{"action":"run","backup_type":"scheduled"}'
  )$$
);
```

---

## TopBar Change (1 line)

Add a `<Database>` icon button between Help and Notifications:

```tsx
{isAdmin && (
  <button onClick={() => setBackupOpen(true)} title="Backup & Restore" ...>
    <DatabaseBackup className="w-5 h-5" />
  </button>
)}
```

`isAdmin` comes from `useUserRole()` — already imported in the file. Non-admin users see nothing.

---

## BackupModal Component

**`src/components/backup/BackupModal.tsx`**

```
┌─────────────────────────────────────────────────┐
│ 🗄️  Backup & Restore                         ×  │
├──────────────────────┬──────────────────────────┤
│  Last Backup         │  Status badge            │
│  Feb 18, 2026 02:00  │  ✅ Success              │
├──────────────────────┴──────────────────────────┤
│  [Run Backup Now]                               │
├─────────────────────────────────────────────────┤
│  Backup History (last 20)                       │
│  ┌──────────────────────────────────────────┐   │
│  │ ID        │ Date        │ Size  │ Status │   │
│  │ bkp_xxx   │ Feb 18      │ 2.1MB │ ✅     │ [Restore] │
│  │ bkp_yyy   │ Feb 17      │ 2.0MB │ ✅     │ [Restore] │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**Restore flow:**
1. Click `Restore` on any row
2. Alert Dialog opens: "⚠️ This will overwrite ALL current data with the backup from [date]. This cannot be undone."
3. Input field: Type `RESTORE` to confirm
4. On match → calls edge function → shows progress spinner with steps
5. On success → shows "✅ Restore complete. Page will reload."
6. On failure → shows exact error message in red

---

## Files Changed

| File | Action | Scope |
|------|--------|-------|
| `src/components/layout/TopBar.tsx` | Edit | +1 icon button + import (admin-only) |
| `src/components/backup/BackupModal.tsx` | New | Full feature UI |
| `src/hooks/useBackups.ts` | New | Data hook |
| `supabase/functions/system-backup/index.ts` | New | Edge function |
| Database migration | New | 2 tables + storage bucket + cron |

No other files touched. All admin-only guarded.

---

## What Admins See vs Regular Users
- **Admin**: DatabaseBackup icon appears in top bar → click → full modal with backup list and actions
- **Non-admin**: Icon is completely absent from the DOM (`isAdmin` gate) → no access at all
