

# Export Dialog + Social Media Integration for Ad Director

## What
1. Create a Clipchamp-style **Export Dialog** with quality selection (1080p/720p/480p), file naming, cloud storage toggle, and optional description.
2. Add a **"Share to Social"** button in the export flow that sends the final video to the Social Media Manager as a draft post (reusing existing `VideoToSocialPanel`).

## Changes

### 1. New Component: `src/components/ad-director/ExportDialog.tsx`
A dialog (using Radix Dialog) inspired by the Clipchamp screenshot:
- **Left side**: Quality radio group (1080p selected by default, 720p, 480p)
- **Right side**: File name input (`.mp4`), "Store in cloud" toggle (default on), description textarea
- **Bottom**: "Export" button + "Share to Social" button
- On export: downloads the `finalVideoUrl` blob as the chosen filename. If "Store in cloud" is on, uploads to `generated-videos` bucket.
- On "Share to Social": opens `VideoToSocialPanel` inline or in a sub-dialog.

### 2. Wire into `ProVideoEditor.tsx` (line 721-729)
Replace the current Export button click → open the ExportDialog instead of calling `onExport` directly. Pass `finalVideoUrl`, `brand.name`, `onExport` through.

### 3. Wire into `FinalPreview.tsx` (line 200-217)
Same: the "Export 30s Ad" button opens the ExportDialog when `finalVideoUrl` is available (assembled state). Falls back to current stitch behavior when not yet assembled.

### 4. `AdDirectorContent.tsx`
- Add state for `exportDialogOpen`.
- Pass `finalVideoUrl` and `handleDownload` to the new dialog.
- The dialog handles download with custom filename and optional cloud upload.

### Technical Details
- Quality selector is cosmetic for now (browser canvas exports at source resolution); labels indicate what resolution the source clips are.
- Cloud upload reuses existing `supabase.storage.from("generated-videos").upload()` pattern.
- Social integration reuses `VideoToSocialPanel` which creates a draft post with the video URL attached.
- No database changes needed.

