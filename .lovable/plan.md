
# Import Odoo Dump -- Local Filestore Upload

Since the current API-based migration is slow (5%, ~48h remaining, errors), you can skip Odoo's API entirely and upload files directly from your downloaded 12GB dump.

---

## How It Works

An Odoo.sh dump contains a `filestore/` folder where each attachment is stored by its checksum (e.g., `ab/ab12cd34...`). We need to match those files to the 17,366 `lead_files` records that still need migration.

### Two-Step Process:

**Step 1 -- Upload a mapping file**
You'll extract a small CSV from the dump's SQL that maps each Odoo attachment ID to its filestore path and filename. A simple query against the dump gives us:
`odoo_id, store_fname, name, mimetype`

**Step 2 -- Select filestore folder and auto-upload**
Using a folder picker, select the extracted `filestore/` directory. The system reads the mapping, finds matching files, and uploads them in parallel batches directly to storage -- no Odoo API needed.

---

## What Gets Built

### 1. "Import from Dump" Button on the Migration Card
- Appears next to the existing Play button
- Opens a dialog with the two-step flow

### 2. Import Dialog (`OdooDumpImportDialog.tsx`)
- **Step 1**: Upload mapping CSV (tiny file, a few MB)
  - Parses it and shows: "Found X attachments matching Y pending lead_files"
- **Step 2**: Folder picker for the `filestore/` directory
  - Reads files from selected folder
  - Matches them to lead_files via the mapping (odoo_id -> store_fname -> local file)
  - Uploads in parallel batches of 5 files to the `estimation-files` storage bucket
  - Updates each `lead_files` record with `storage_path` and `file_url`
  - Shows live progress (X / Y uploaded, errors)

### 3. All Processing Happens Client-Side
- No edge function needed for the import itself
- Browser reads files one at a time (no 12GB in memory)
- Uploads directly to storage bucket using the Supabase client
- Updates the database directly
- Progress bar and error handling built into the dialog

---

## Technical Details

### Files to Create
- `src/components/admin/OdooDumpImportDialog.tsx` -- The import dialog with mapping + folder upload

### Files to Modify
- `src/components/admin/OdooMigrationStatusCard.tsx` -- Add "Import Dump" button

### Mapping CSV Format (user extracts from dump.sql)
```text
id,store_fname,name,mimetype
40650,ab/ab12cd34ef...,image003.png,image/png
40649,cd/cd56ef78ab...,image002.png,image/png
```

### Upload Logic (client-side)
```text
For each pending lead_file (odoo_id with no storage_path):
  1. Look up store_fname from mapping CSV
  2. Find that file in the selected filestore folder
  3. Upload to estimation-files/odoo-archive/{lead_id}/{odoo_id}-{filename}
  4. Update lead_files row with storage_path + file_url
  5. Show progress, skip and log errors
```

### Parallel Batch Upload
- 5 concurrent uploads at a time
- Each file is read individually (FileReader API) so memory stays low
- Abort button to stop mid-import
- Resume-safe: skips files that already have storage_path

### Instructions for the User
The dialog will include clear instructions on how to:
1. Extract the dump ZIP
2. Run a simple SQL/grep command to generate the mapping CSV from `dump.sql`
3. Select the `filestore/` folder
