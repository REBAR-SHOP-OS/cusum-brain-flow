

# Support ZIP File Import (No Extraction Needed)

Instead of requiring you to extract the 12GB ZIP first and select the `filestore/` folder, the import dialog will accept the ZIP file directly. A streaming ZIP library reads only the files we need without loading 12GB into memory.

---

## What Changes

### Current Flow (requires extraction)
1. Extract ZIP on your computer
2. Upload mapping CSV
3. Select the extracted `filestore/` folder

### New Flow (just select the ZIP)
1. Upload mapping CSV
2. Select the `.zip` file directly -- done

---

## How It Works

- Uses the `zip.js` library which can read ZIP entries on-demand from a local file (random access, no full decompression into memory)
- After the mapping CSV is loaded, you pick the ZIP file
- The system scans the ZIP's file listing, matches entries to the mapping CSV, then extracts and uploads only the matched files in batches of 5
- Progress bar, abort button, and error handling remain the same

---

## Technical Details

### New Dependency
- `@zip.js/zip.js` -- mature streaming ZIP library with File/Blob reader support

### Files to Modify
- **`src/components/admin/OdooDumpImportDialog.tsx`**
  - Replace the folder picker (Step 2) with a file input accepting `.zip`
  - Use `zip.js` `BlobReader` + `ZipReader` to list entries in the ZIP
  - Match ZIP entry paths (e.g., `filestore/ab/ab12cd34...`) to mapping CSV `store_fname` values
  - Extract each matched entry as a `Blob`, then upload to storage
  - Keep the same batch-of-5 parallel upload pattern
  - Keep the existing folder picker as a fallback option (tab or toggle: "ZIP file" vs "Extracted folder")

### Memory Efficiency
- `zip.js` reads the ZIP via random access on the local `File` object -- it does NOT load 12GB into memory
- Each file is extracted individually, uploaded, then garbage collected
- Only 5 files in memory at any time (batch size)

