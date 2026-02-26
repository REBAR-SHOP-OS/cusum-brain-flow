

# Import from Odoo Dump ZIP -- Status Check

## Current State

The feature **already exists and is fully functional**. Here is the flow:

1. Navigate to the **Admin dashboard** (the OdooMigrationStatusCard is rendered there)
2. Click the **hard drive upload icon** (HardDriveUpload) next to "Odoo File Migration"
3. Select your Odoo dump ZIP file (must contain `dump.sql` + `filestore/` directory)
4. The dialog streams `dump.sql` to extract `ir_attachment` mappings for `crm.lead`
5. It matches those against the 15,260 pending `lead_files` records (where `storage_path IS NULL`)
6. Matched files are uploaded to local storage in batches of 3 with retry logic

## No Code Changes Needed

The `OdooDumpImportDialog` component does NOT call Odoo's API -- it reads entirely from the local ZIP file. The `ODOO_ENABLED` guard only affects the `archive-odoo-files` edge function (which fetches files live from Odoo via JSON-RPC). The dump import dialog bypasses that entirely.

## How to Use It

1. Go to `/admin` or wherever the `OdooMigrationStatusCard` is rendered
2. Click the upload icon next to the migration card title
3. Select your `.zip` file
4. Wait for it to stream-parse `dump.sql`, match files, and upload

The dialog shows progress, handles failures with retry, and supports abort.

## If the Button Is Not Visible

The button only shows when `!done` (remaining files > 0). With 15,260 files pending, it should be visible. If the migration card itself is not showing, confirm you are on the admin page and have admin role access.

