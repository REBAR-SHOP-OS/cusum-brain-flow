

# Add Download Video Button to Editor Toolbar

## What
Add a Download icon button next to the "Edit" badge and "Schedule" button in the Pro Video Editor top toolbar, allowing users to download the final video directly.

## Fix
**File: `src/components/ad-director/ProVideoEditor.tsx`** (around line 1218)

Insert a Download button between the "Edit" badge and the `ScheduleToSocialPopover`:

```tsx
<Badge variant="secondary" className="text-[9px]">Edit</Badge>

{/* NEW: Download button */}
<Button
  variant="outline"
  size="sm"
  className="h-7 text-[10px] gap-1"
  disabled={!finalVideoUrl}
  onClick={() => {
    if (!finalVideoUrl) return;
    const a = document.createElement("a");
    a.href = finalVideoUrl;
    a.download = `${brand.name || "video"}-ad.mp4`;
    a.click();
  }}
>
  <Download className="w-3 h-3" />
  Download
</Button>

<ScheduleToSocialPopover ... />
```

`Download` icon is already imported from `lucide-react` in this file.

## Files Changed
- `src/components/ad-director/ProVideoEditor.tsx` — add Download button in toolbar (line ~1218)

