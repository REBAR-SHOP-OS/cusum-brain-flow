

# ZIP File Upload and Analysis for Website Chat

## Overview

Add the ability to upload ZIP files in the Job Site chat. When a ZIP is uploaded, the system will extract and list its contents (file names, sizes, types), then send that analysis to the AI so it can provide intelligent feedback about the archive contents -- whether it's a WordPress plugin, theme, backup, image batch, or drawing package.

## What You'll See

- The file attachment button now accepts ZIP files in addition to images and PDFs
- When you attach a ZIP, a preview card shows with a folder/archive icon and file name
- On send, the ZIP is extracted client-side using zip.js (already installed), producing a structured file listing
- The file listing (name, size, type for each entry) is appended to your message and sent to the AI
- The AI can then advise on the contents: identify plugins, flag missing files, suggest next steps, etc.
- Individual images inside the ZIP are extracted, uploaded, and sent as image attachments for visual analysis

## Technical Details

### Modified Files

| File | Change |
|------|---------|
| `src/components/website/WebsiteChat.tsx` | Accept .zip files, extract contents client-side, send structured listing to AI, upload embedded images |

### Changes to WebsiteChat.tsx

1. **File filter update**: Change the `addFiles` filter from `image/* + PDF only` to also accept `application/zip`, `application/x-zip-compressed`, and files ending in `.zip`

2. **File input accept**: Update the hidden `<input>` from `accept="image/*,application/pdf"` to `accept="image/*,application/pdf,.zip,application/zip"`

3. **ZIP analysis function**: Add an `analyzeZip` helper that uses `ZipReader` from `@zip.js/zip.js` to:
   - Read all entries in the ZIP
   - Build a structured summary: total files, total size, file tree with names/sizes/types
   - Extract up to 3 image files (jpg/png/webp) for visual preview and upload them
   - Return the text summary + extracted image URLs

4. **Updated handleSend**: Before sending, check if any attachment is a ZIP. If so, run `analyzeZip`, append the structured file listing to the message text, and include any extracted images as `imageUrls`

5. **Preview card for ZIP**: Show a file archive icon with the ZIP filename instead of trying to render an image preview

### ZIP Analysis Output Format (sent to AI)

```
[ZIP Analysis: theme-starter.zip]
Total files: 47 | Total size: 2.3 MB

Directory structure:
- style.css (12 KB)
- functions.php (8 KB)
- header.php (3 KB)
- assets/
  - assets/logo.png (45 KB)
  - assets/banner.jpg (320 KB)
- templates/
  - templates/home.php (5 KB)
  - templates/archive.php (4 KB)
...
```

### No Backend Changes

All ZIP extraction happens client-side using the already-installed `@zip.js/zip.js` library. The extracted text summary goes to the existing AI chat endpoint. No edge function changes needed.

### No Database Changes

No migrations required.
