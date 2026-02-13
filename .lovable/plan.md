

# Fix: Show ZIP Option Immediately

The ZIP upload tab is already coded but hidden behind Step 1 — it only appears after uploading the CSV mapping file. This makes it look like ZIP isn't supported.

## Changes

### File: `src/components/admin/OdooDumpImportDialog.tsx`

- Remove the step gating on Step 2 — always show both steps visible from the start
- Disable the ZIP/folder file inputs until the CSV mapping is loaded (with a hint: "Upload mapping CSV first")
- This way the user can immediately see the ZIP option exists, while still requiring the CSV first (since we need the mapping to know which files to extract)

### Details

- Line 286: Change `{(step === 2 || uploading || uploaded > 0) &&` to always render Step 2
- Add a `disabled` state to the ZIP and folder inputs when `mapping.length === 0`
- Remove the "Next" button since both steps are always visible
- Add a small note under Step 2 when CSV isn't loaded yet: "Upload mapping CSV above first"

