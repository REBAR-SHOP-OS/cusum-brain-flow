
# Remove "AI Transcribe" from Office Sidebar

Simple removal of the "AI Transcribe" entry from the office tools sidebar.

## Changes

### `src/components/office/OfficeSidebar.tsx`
- Remove the `"ai-transcribe"` entry from the `officeTools` array (line 35)
- Remove `"ai-transcribe"` from the `OfficeSection` type union
- Remove the unused `Languages` icon import
