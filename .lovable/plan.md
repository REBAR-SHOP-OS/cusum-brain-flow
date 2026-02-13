

# Fix: Enable File Inputs Without CSV Gate

The "Choose File" buttons are disabled because the code requires the CSV mapping to be uploaded first. The fix is to allow selecting files at any time, but show a warning if no CSV mapping is loaded when they try to process.

## Changes

### File: `src/components/admin/OdooDumpImportDialog.tsx`

1. **Remove `disabled` gate from ZIP input** (line ~306): Change `disabled={uploading || mapping.length === 0}` to `disabled={uploading}`
2. **Remove `disabled` gate from folder button** (line ~317): Change `disabled={uploading || mapping.length === 0}` to `disabled={uploading}`  
3. **Add early validation in handlers**: In both `handleZipSelect` and `handleFolderSelect`, check if `mapping.length === 0` and show a toast error "Please upload the mapping CSV first" and return early

This way the buttons are always clickable, but the user gets clear feedback if they try to use them without the CSV.

