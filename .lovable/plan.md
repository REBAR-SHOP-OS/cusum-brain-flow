
# بهبود بخش Attachments و Comments در دِرِوِر تسک

## مشکلات موجود

1. **دو "Upload file" تکراری**: در Attachments section دو حالت مجزا وجود دارد:
   - یکی بالای لیست فایل‌ها (خط 828-832) — همیشه نمایش داده می‌شود
   - یکی دیگر داخل بلاک "no attachments" (خط 845-850) — وقتی فایلی نیست نشان داده می‌شود

2. **بدون قابلیت حذف فایل**: هر attachment فقط یک لینک است — هیچ دکمه delete‌ای ندارد

3. **کامنت باکس خیلی کوچک**: از `<Input>` با `h-8` استفاده شده — یک خطی است و متن را نمی‌توان دید

## تغییرات — فقط `src/pages/Tasks.tsx`

### 1. یکپارچه‌سازی دکمه آپلود (خطوط 824-853)

به جای دو "Upload file" link، یک آیکون آپلود کنار عنوان "Attachments" قرار می‌گیرد:

```tsx
<h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
  <Paperclip className="w-3 h-3" /> Attachments
  {isInternal && (
    <label className="ml-auto cursor-pointer text-muted-foreground hover:text-primary transition-colors" title="Upload file">
      <Upload className="w-3.5 h-3.5" />
      <input type="file" multiple className="sr-only" onChange={handleDrawerUpload} />
    </label>
  )}
</h4>
```

این روش: یک آپلود باتن، همیشه در header، تمیز و بدون تکرار.

### 2. اضافه کردن دکمه حذف فایل

برای هر فایل، یک دکمه X کنار لینک آن قرار می‌گیرد (فقط برای `isInternal`):

```tsx
{((selectedTask as any).attachment_urls as string[]).map((url, i) => (
  <div key={i} className="flex items-center gap-1 group/attachment">
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate flex-1">
      <ExternalLink className="w-3 h-3 shrink-0" />
      {url.split("/").pop()?.split("?")[0] || `Attachment ${i + 1}`}
    </a>
    {isInternal && (
      <button
        onClick={() => deleteAttachment(url, i)}
        className="opacity-0 group-hover/attachment:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
        title="Remove attachment"
      >
        <X className="w-3 h-3" />
      </button>
    )}
  </div>
))}
```

تابع `deleteAttachment` باید:
1. فایل را از storage حذف کند (در صورت امکان استخراج path از URL)
2. آرایه `attachment_urls` را در دیتابیس آپدیت کند (بدون آن URL)
3. `loadData()` را صدا بزند

### 3. بزرگ‌تر کردن کامنت باکس (خطوط 809-820)

تبدیل `<Input>` به `<Textarea>` با حداقل ارتفاع ۳ خط:

```tsx
<div className="flex gap-2 mt-2 items-end">
  <Textarea
    value={newComment}
    onChange={e => setNewComment(e.target.value)}
    placeholder="Add a comment..."
    className="text-xs min-h-[72px] resize-none flex-1"
    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); } }}
  />
  <Button size="icon" className="h-8 w-8 shrink-0 mb-1" onClick={postComment} disabled={submittingComment || !newComment.trim()}>
    <Send className="w-3.5 h-3.5" />
  </Button>
</div>
```

### 4. Import اضافه

- `Upload` از `lucide-react` اضافه می‌شود
- `Textarea` از `@/components/ui/textarea` اضافه می‌شود

## خلاصه تغییرات

| موضوع | قبل | بعد |
|---|---|---|
| Upload button | دو "Upload file" link تکراری | یک آیکون Upload در header |
| حذف فایل | امکان ندارد | دکمه X هنگام hover (فقط internal) |
| کامنت باکس | Input تک‌خطی h-8 | Textarea با min-h 72px |

فقط یک فایل تغییر می‌کند: `src/pages/Tasks.tsx`
