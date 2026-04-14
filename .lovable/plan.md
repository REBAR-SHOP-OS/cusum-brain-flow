

## Plan: Sanitize File Names for Chat Uploads

### Problem
Uploading files with special characters in their names (spaces, parentheses, em-dashes like `–`) causes "Invalid key" errors in storage. The file name `Executive Marketing Performance Report_Rebar.shop (March–April 2026).pdf` contains spaces, parentheses, and an em-dash — all invalid in storage paths.

### Solution
Create a shared `sanitizeFileName` utility that strips/replaces unsafe characters from file names before building the storage path. Apply it in all upload locations.

### Helper Function
```typescript
// src/lib/sanitizeFileName.ts
export function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-zA-Z0-9._-]/g, "_")                // replace unsafe chars with underscore
    .replace(/_+/g, "_")                               // collapse multiple underscores
    .replace(/^_|_$/g, "");                            // trim leading/trailing underscores
}
```

### Files to Change
| File | Change |
|---|---|
| `src/lib/sanitizeFileName.ts` | New file — utility function |
| `src/components/chat/DockChatBox.tsx` | Line 242: use `sanitizeFileName(pf.name)` in path |
| `src/components/website/WebsiteChat.tsx` | Line 98: use `sanitizeFileName(file.name)` in path |
| `src/components/accounting/AccountingAgent.tsx` | Line 201: use `sanitizeFileName(file.name)` in path |
| `src/pages/EmpireBuilder.tsx` | Line 217: use `sanitizeFileName(pf.file.name)` in path |
| `src/lib/zipAnalyzer.ts` | Line 72: use `sanitizeFileName(...)` in path |

### Result
All file uploads sanitize the file name to safe ASCII characters, preventing "Invalid key" storage errors. The original display name is preserved in the message metadata (already stored separately in `pf.name` / result objects).

