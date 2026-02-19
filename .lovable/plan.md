
# اضافه کردن قابلیت Paste تصویر در Description — دیالوگ New Task

## درخواست کاربر

کاربر می‌خواهد وقتی در فیلد Description دیالوگ "New Task" یک تصویر را Ctrl+V می‌کند، آن تصویر به عنوان attachment اضافه شود (نه اینکه در متن باشد).

## راه‌حل

یک handler رویداد `paste` به `<textarea>` اضافه می‌شود. وقتی کاربر تصویری را paste می‌کند:
1. تصویر از clipboard گرفته می‌شود
2. به آرایه `pendingFiles` اضافه می‌شود (دقیقاً مثل انتخاب فایل از دکمه attach)
3. در لیست فایل‌های انتخاب‌شده نمایش داده می‌شود
4. هنگام ساخت تسک، آپلود می‌شود

## تغییرات فنی — فقط `src/pages/Tasks.tsx`

### خط 637 — اضافه کردن onPaste handler به textarea

```tsx
<textarea
  value={newDesc}
  onChange={e => setNewDesc(e.target.value)}
  onPaste={handleDescPaste}
  placeholder="Optional description — Ctrl+V to paste images"
  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
/>
```

### تابع جدید `handleDescPaste` (قبل از render)

```tsx
const handleDescPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
  const items = Array.from(e.clipboardData.items);
  const imageItems = items.filter(item => item.type.startsWith("image/"));
  if (imageItems.length === 0) return; // اگر متن است، رفتار پیش‌فرض حفظ شود
  e.preventDefault(); // از paste متن base64 جلوگیری کن
  const newFiles: File[] = [];
  imageItems.forEach(item => {
    const blob = item.getAsFile();
    if (blob) {
      const fileName = `pasted-image-${Date.now()}.png`;
      const file = new File([blob], fileName, { type: blob.type });
      newFiles.push(file);
    }
  });
  if (newFiles.length > 0) {
    setPendingFiles(prev => [...prev, ...newFiles]);
    toast.success(`${newFiles.length} image(s) added from clipboard`);
  }
};
```

### نمایش بخش Attachments برای همه کاربران (نه فقط internal)

فعلاً بخش Attachments با شرط `{isInternal && ...}` گیت شده. چون paste تصویر توسط همه کاربران قابل انجام است، باید:
- بخش نمایش فایل‌های در انتظار (`pendingFiles`) برای همه کاربران نمایش داده شود
- فقط دکمه "Click to attach files" محدود به internal بماند

## رفتار نهایی

| سناریو | نتیجه |
|---|---|
| کاربر Ctrl+V تصویر در Description | تصویر به لیست attachments اضافه می‌شود |
| کاربر Ctrl+V متن در Description | متن مثل قبل در textarea وارد می‌شود |
| چند تصویر paste شود | همه اضافه می‌شوند |
| تسک ساخته شود | تصاویر آپلود و ذخیره می‌شوند |

## فایل تغییر یافته

فقط `src/pages/Tasks.tsx` — اضافه کردن تابع `handleDescPaste` و `onPaste` prop به textarea.
