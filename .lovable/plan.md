
# Implement File Attachment in Tasks (Previously Unimplemented)

## What Happened

The plan was approved previously but the code was never written to `Tasks.tsx`. The file is currently at 780 lines with zero attachment upload logic. This plan implements it now.

## Confirmed Current State of Tasks.tsx

- Lines 165-171: No `currentUserEmail`, `pendingFiles`, or `uploadingFiles` state
- Lines 178-191: Only captures `user_id` and `profile_id` — no email
- Lines 554-592: Create Task Dialog has Title, Description, Due Date, Priority only — no file picker
- Lines 335-374: `createTask()` has no upload logic
- Lines 744-760: Attachments section exists in drawer but is display-only with no upload button

## All Changes — Only `src/pages/Tasks.tsx`

### 1. Add `X` to lucide-react imports (line 4)
Currently: `CheckSquare, Plus, RefreshCw, Copy, Check, Maximize2, Minus, Sparkles, MessageSquare, Paperclip, Send, Trash2, ExternalLink`
Add: `X` to the list

### 2. Add state variables (after line 171)
```ts
const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
const [pendingFiles, setPendingFiles] = useState<File[]>([]);
const [uploadingFiles, setUploadingFiles] = useState(false);
```

### 3. Capture user email in the existing useEffect (lines 178-191)
```ts
// After setCurrentUserId(uid):
setCurrentUserEmail(data.user?.email ?? null);
```

### 4. Derive isInternal (after the useEffect, before loadData)
```ts
const isInternal = (currentUserEmail ?? "").endsWith("@rebar.shop");
```

### 5. Add file handlers (before createTask function)
```ts
const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  setPendingFiles(prev => [...prev, ...files]);
  e.target.value = "";
};
const removeFile = (index: number) => {
  setPendingFiles(prev => prev.filter((_, i) => i !== index));
};
```

### 6. Modify createTask() to upload files after insert (lines 354-371)
After `await writeAudit(...)`, add upload logic:
```ts
// Upload pending files
if (pendingFiles.length > 0) {
  setUploadingFiles(true);
  const urls: string[] = [];
  for (const file of pendingFiles) {
    const path = `task-attachments/${data.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("clearance-photos").upload(path, file);
    if (!upErr) {
      const { data: signed } = await supabase.storage
        .from("clearance-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) urls.push(signed.signedUrl);
    }
  }
  if (urls.length > 0) {
    await supabase.from("tasks").update({ attachment_urls: urls } as any).eq("id", data.id);
  }
  setPendingFiles([]);
  setUploadingFiles(false);
}
```
Also reset `setPendingFiles([])` in the cleanup at line 370.

### 7. Add file picker UI in Create Task Dialog (after the priority grid, before the Create Task button — line 587)
```tsx
{isInternal && (
  <div>
    <Label className="text-xs">Attachments</Label>
    <label className="mt-1 flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-input px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors">
      <Paperclip className="w-3.5 h-3.5 shrink-0" />
      {pendingFiles.length > 0 ? `${pendingFiles.length} file(s) selected` : "Click to attach files"}
      <input type="file" multiple className="sr-only" onChange={handleFilePick} />
    </label>
    {pendingFiles.length > 0 && (
      <div className="mt-1 space-y-1">
        {pendingFiles.map((f, i) => (
          <div key={i} className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">
            <span className="truncate">{f.name}</span>
            <button onClick={() => removeFile(i)} type="button">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```
Update Create Task button to show uploading state: `{creating || uploadingFiles ? "Creating..." : "Create Task"}`

### 8. Add Upload button in drawer Attachments section (line 757-759)
Replace the "No attachments" paragraph with:
```tsx
{isInternal && (
  <label className="flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline mt-1">
    <Paperclip className="w-3 h-3" /> Upload file
    <input type="file" multiple className="sr-only" onChange={handleDrawerUpload} />
  </label>
)}
{((selectedTask as any)?.attachment_urls?.length === 0 || !(selectedTask as any)?.attachment_urls) && (
  <p className="text-xs text-muted-foreground">No attachments</p>
)}
```

Add `handleDrawerUpload` function that uploads to `clearance-photos`, appends new signed URLs to the existing `attachment_urls` array, and refreshes the drawer.

## No DB changes. No new storage buckets. attachment_urls column already exists.
