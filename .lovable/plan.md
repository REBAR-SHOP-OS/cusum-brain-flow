
# اضافه کردن قابلیت Paste و آپلود فایل به بخش Add a Comment

## درخواست کاربر

کاربر می‌خواهد در فیلد "Add a comment..." بتواند:
- تصویر یا فایل را **Ctrl+V** کند (paste)
- متن کپی‌شده را paste کند (رفتار فعلی حفظ شود)

## وضعیت فعلی

فیلد کامنت (`<Textarea>`) در خط 841 فقط متن می‌پذیرد و هیچ `onPaste` handler ندارد. جدول `task_comments` ستون‌های زیر دارد:
- `id`, `task_id`, `profile_id`, `content`, `company_id`, `created_at`

ستون جداگانه‌ای برای فایل‌های attachment کامنت وجود ندارد.

## استراتژی کلی

وقتی کاربر تصویری را paste می‌کند:
1. تصویر در Storage آپلود می‌شود (همان bucket که `handleDrawerUpload` استفاده می‌کند)
2. URL آن به عنوان یک **preview کوچک** زیر textarea نمایش داده می‌شود
3. هنگام ارسال کامنت، URL در متن کامنت embed می‌شود (مثلاً `[image](url)` یا آدرس مستقیم)
4. در نمایش کامنت‌ها، لینک‌های تصویر به صورت thumbnail کوچک رندر می‌شوند

## تغییرات فنی — فقط `src/pages/Tasks.tsx`

### ۱. state جدید برای فایل‌های در انتظار کامنت

```tsx
const [commentFiles, setCommentFiles] = useState<{file: File, previewUrl: string}[]>([]);
const [uploadingCommentFiles, setUploadingCommentFiles] = useState(false);
```

### ۲. تابع `handleCommentPaste` — جایگزین paste پیش‌فرض برای تصاویر

```tsx
const handleCommentPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
  const items = Array.from(e.clipboardData.items);
  const imageItems = items.filter(item => item.type.startsWith("image/"));
  if (imageItems.length === 0) return; // متن: رفتار پیش‌فرض حفظ شود
  e.preventDefault();
  const newFiles = imageItems.map(item => {
    const blob = item.getAsFile()!;
    const file = new File([blob], `comment-image-${Date.now()}.png`, { type: blob.type });
    return { file, previewUrl: URL.createObjectURL(blob) };
  });
  setCommentFiles(prev => [...prev, ...newFiles]);
};
```

### ۳. آپلود فایل‌های کامنت در `postComment`

قبل از insert کامنت، فایل‌های انتظار آپلود می‌شوند و URL‌هایشان به محتوای کامنت اضافه می‌شوند:

```tsx
const postComment = async () => {
  if (!newComment.trim() && commentFiles.length === 0) return;
  if (!selectedTask || !currentProfileId) return;
  setSubmittingComment(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let content = newComment.trim();
    
    // آپلود تصاویر
    if (commentFiles.length > 0) {
      setUploadingCommentFiles(true);
      for (const { file } of commentFiles) {
        const path = `${user?.id}/${crypto.randomUUID()}.png`;
        const { error } = await supabase.storage.from("estimation-files").upload(path, file);
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from("estimation-files").getPublicUrl(path);
          content += `\n${publicUrl}`;
        }
      }
      setUploadingCommentFiles(false);
    }
    
    await supabase.from("task_comments").insert({ task_id: selectedTask.id, profile_id: currentProfileId, content, company_id: ... });
    setNewComment("");
    setCommentFiles([]);
    loadComments(selectedTask.id);
  } catch (err: any) { toast.error(err.message); }
  finally { setSubmittingComment(false); }
};
```

### ۴. نمایش preview تصاویر پیست‌شده زیر textarea

قبل از دکمه Send، یک ردیف preview:

```tsx
{commentFiles.length > 0 && (
  <div className="flex flex-wrap gap-1 mb-1">
    {commentFiles.map((cf, i) => (
      <div key={i} className="relative">
        <img src={cf.previewUrl} className="h-12 w-12 object-cover rounded border border-border" />
        <button onClick={() => setCommentFiles(prev => prev.filter((_, j) => j !== i))}
          className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center">
          <X className="w-2.5 h-2.5" />
        </button>
      </div>
    ))}
  </div>
)}
```

### ۵. نمایش تصاویر در کامنت‌ها

در رندر کامنت (`c.content`)، لینک‌هایی که به storage اشاره می‌کنند به صورت `<img>` نمایش داده می‌شوند:

```tsx
// تشخیص URL تصویر در content و نمایش به صورن thumbnail
{c.content.split('\n').map((line, j) => (
  line.startsWith('https://') && /\.(png|jpg|jpeg|webp|gif)/i.test(line)
    ? <img key={j} src={line} className="mt-1 max-h-32 rounded cursor-pointer" onClick={() => window.open(line)} />
    : <span key={j}>{line}</span>
))}
```

### ۶. هماهنگ‌سازی `postComment` با `commentFiles` (دکمه Send)

دکمه Send فعال می‌ماند حتی وقتی فقط تصویر وجود دارد و متن خالی است:

```tsx
disabled={submittingComment || uploadingCommentFiles || (!newComment.trim() && commentFiles.length === 0)}
```

## فایل تغییر یافته

فقط `src/pages/Tasks.tsx` — بدون تغییر در دیتابیس، بدون تغییر در UI کلی اپ.

| جزء | تغییر |
|---|---|
| state | 2 state جدید |
| `handleCommentPaste` | تابع جدید |
| `postComment` | آپلود فایل قبل از insert |
| Textarea | `onPaste={handleCommentPaste}` |
| Preview | ردیف thumbnail زیر textarea |
| Comment render | تشخیص و نمایش تصاویر |
