
# Add File Attachment to Task Creation Dialog (rebar.shop Users Only)

## Current State

The Task page (`src/pages/Tasks.tsx`) already has:
- `attachment_urls` (text array) column on the `tasks` table — confirmed in the DB schema
- An Attachments section in the task detail drawer (lines 743-760) that **displays** existing URLs but has no upload button
- The Create Task dialog (lines 554-592) with Title, Description, Due Date, Priority — **no file upload**
- The `clearance-photos` bucket exists and is already used for task-related uploads

**What's missing:** A file picker in the Create Task dialog, visible only to `@rebar.shop` users.

## Scope — Only `src/pages/Tasks.tsx`

### Change 1: Capture user email
In the `useEffect` (line 178-191) that already fetches `user?.id`, also read `user?.email` and store it:

```ts
const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
// inside the useEffect:
setCurrentUserEmail(data.user?.email ?? null);
```

Then derive once:
```ts
const isInternal = (currentUserEmail ?? "").endsWith("@rebar.shop");
```

---

### Change 2: File state for the Create Task dialog
Add three new state variables alongside the existing create-modal states (lines 165-171):

```ts
const [pendingFiles, setPendingFiles] = useState<File[]>([]);
const [uploadingFiles, setUploadingFiles] = useState(false);
```

Reset them when the dialog closes (alongside `setNewTitle("")` etc.).

---

### Change 3: File picker UI in the Create Task dialog
Inside the dialog (after the Due Date / Priority grid, before the Create Task button), add a section that only renders when `isInternal`:

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
            <button onClick={() => removeFile(i)} type="button"><X className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

Add `X` to existing lucide imports (already imported: `Paperclip`).

---

### Change 4: Upload logic inside `createTask()`
After the task row is inserted and its `id` is known (line 352 — `.select().single()`), if `pendingFiles.length > 0`:

```ts
// Upload each file to clearance-photos/task-attachments/{taskId}/
const urls: string[] = [];
for (const file of pendingFiles) {
  const path = `task-attachments/${data.id}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from("clearance-photos").upload(path, file);
  if (!upErr) {
    const { data: signed } = await supabase.storage.from("clearance-photos").createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
    if (signed?.signedUrl) urls.push(signed.signedUrl);
  }
}
// Patch the task with attachment_urls
if (urls.length > 0) {
  await supabase.from("tasks").update({ attachment_urls: urls } as any).eq("id", data.id);
}
```

---

### Change 5: Upload button in the detail drawer (bonus, same file)
In the Attachments section of the detail drawer (line 744-760), add an upload button also gated by `isInternal`:

```tsx
{isInternal && (
  <label className="flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
    <Paperclip className="w-3 h-3" /> Upload file
    <input type="file" multiple className="sr-only" onChange={handleDrawerUpload} />
  </label>
)}
```

The `handleDrawerUpload` function uploads files to `task-attachments/{selectedTask.id}/...`, appends signed URLs to the existing `attachment_urls` array, and calls `loadData()` to refresh.

---

## Summary of Changes

| Location | What changes |
|---|---|
| State declarations (~line 165) | Add `currentUserEmail`, `pendingFiles`, `uploadingFiles` |
| `useEffect` (~line 179) | Capture `data.user?.email` |
| `isInternal` constant | Derived from `currentUserEmail` |
| `createTask()` (~line 335) | After insert: upload files, patch `attachment_urls`, reset `pendingFiles` |
| Create Task dialog (~line 585) | File picker section (gated by `isInternal`) |
| Detail drawer Attachments (~line 757) | Upload button (gated by `isInternal`) |
| Imports | Add `X` from lucide-react |

**No other files are modified. No DB migrations needed (`attachment_urls` column already exists). No new storage buckets needed (`clearance-photos` already exists).**
