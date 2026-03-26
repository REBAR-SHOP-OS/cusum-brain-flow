

# Show Original Filename Instead of UUID in File Cards

## Problem
File cards in the timeline show UUID-based names like `acd3553b-6a66-4287-a645-8d...` because `extractFileName` extracts the last path segment from the storage URL, which is a UUID when the file was uploaded via Supabase storage (the object path includes a UUID).

## Solution
Update `extractFileName` in `InlineFileLink.tsx` to strip the timestamp prefix pattern from the filename. The storage path format is `lead-attachments/{id}/{timestamp}-{safeName}`, so after extracting the last segment, strip the leading `{digits}-` prefix to recover the original filename.

## Changes

### `src/components/pipeline/InlineFileLink.tsx` — `extractFileName` function

Update the function to:
1. Extract the last path segment as before
2. Strip a leading numeric timestamp prefix (pattern: `\d+-`) to recover the original safe name
3. Replace underscores back to spaces for readability (since upload replaces non-alphanumeric chars with `_`)

```typescript
function extractFileName(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segments = path.split("/").filter(Boolean);
    let last = decodeURIComponent(segments[segments.length - 1] || "file");
    // Strip leading timestamp prefix (e.g., "1711234567890-")
    last = last.replace(/^\d+-/, "");
    return last || "file";
  } catch {
    return "file";
  }
}
```

Single function change, no other files affected.

