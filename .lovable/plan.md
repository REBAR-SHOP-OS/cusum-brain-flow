
# Upgrade Backup & Restore -- Download, Delete, Import, Logs

## Current State
- Backup icon already exists in TopBar (admin-only) -- NO CHANGE needed there
- BackupModal has: Run Backup, Refresh, Restore -- but is MISSING: Download, Delete, Import, Logs
- Edge function supports: `run`, `restore`, `list` -- needs: `download`, `delete`, `import`, `logs`
- `backup_restore_logs` table exists but no UI shows it
- `system-backups` storage bucket exists (private)
- Auto backup cron already configured (every 12 hours)

## What Will Be Added

### 1. Edge Function: 4 New Actions
**File: `supabase/functions/system-backup/index.ts`**

- **`download`** -- Generate a signed URL (60-minute expiry) for the backup file in storage. Returns `{ url: "..." }`.
- **`delete`** -- Requires `confirm: "DELETE"`. Deletes the file from storage AND the record from `system_backups`. Logs to `backup_restore_logs`.
- **`import`** -- Accepts base64-encoded backup JSON. Validates structure, stores in storage bucket, creates a `system_backups` record with `backup_type: "imported"`. Logs to `backup_restore_logs`.
- **`logs`** -- Returns last 20 entries from `backup_restore_logs` ordered by `created_at desc`.

### 2. Frontend Hook: New Mutations + Logs Query
**File: `src/hooks/useBackups.ts`**

- `useDownloadBackup()` -- calls `action: "download"`, opens signed URL in new tab
- `useDeleteBackup()` -- calls `action: "delete"` with `confirm: "DELETE"`
- `useImportBackup()` -- reads uploaded file, sends base64 to `action: "import"`
- `useBackupLogs()` -- calls `action: "logs"`, returns recent audit entries
- Update `SystemBackup.backup_type` to include `"imported"`

### 3. BackupModal UI Enhancements
**File: `src/components/backup/BackupModal.tsx`**

**Actions row additions:**
- "Import Backup" button next to "Run Backup Now"

**Table Actions column:**
- For each successful backup: **Restore** | **Download** | **Delete** buttons
- Download: immediate signed-URL download
- Delete: opens confirmation dialog requiring user to type `DELETE`

**New section at bottom of modal:**
- "Recent Logs" collapsible section showing last 20 audit entries (action, user, time, result)
- Columns: Action, User, Date, Result

**Delete confirmation dialog:**
- Similar to Restore dialog but with `DELETE` confirmation text
- Warning: "This will permanently remove this backup file."

## Files Modified (ONLY these)

| File | Change |
|------|--------|
| `supabase/functions/system-backup/index.ts` | Add `download`, `delete`, `import`, `logs` actions |
| `src/hooks/useBackups.ts` | Add 4 new hooks + logs query |
| `src/components/backup/BackupModal.tsx` | Add Download/Delete/Import buttons + Delete dialog + Logs section |

## No Changes To
- TopBar (already has backup icon, admin-only)
- Database schema (tables already exist)
- Storage bucket (already exists)
- Cron schedule (already running every 12h)
- Any other component, page, route, or logic in the app

## Technical Details

### Download Flow
1. User clicks Download on a backup row
2. Frontend calls edge function with `{ action: "download", backup_id: "..." }`
3. Edge function generates signed URL via `serviceClient.storage.from("system-backups").createSignedUrl(filePath, 3600)`
4. Frontend opens URL in new tab (browser downloads the JSON file)

### Delete Flow
1. User clicks Delete on a backup row
2. Confirmation dialog opens: "Type DELETE to permanently remove this backup"
3. Edge function deletes file from storage: `serviceClient.storage.from("system-backups").remove([filePath])`
4. Deletes record from `system_backups` table
5. Logs action to `backup_restore_logs`

### Import Flow
1. User clicks "Import Backup"
2. File picker opens (accepts .json)
3. File is read as text, validated (must have `version` and `tables` keys)
4. Sent to edge function as `{ action: "import", data: <json_string> }`
5. Edge function stores file in storage bucket, creates `system_backups` record with `backup_type: "imported"`
6. Appears in backup list, can be restored or downloaded

### Logs Section
- Collapsible "Recent Logs" at the bottom of the modal
- Shows last 20 log entries from `backup_restore_logs`
- Columns: Action (backup/restore/delete/download/import), User, Date, Result (success/failed)
