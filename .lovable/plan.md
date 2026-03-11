

## حذف کامل کارت و تمام پست‌های مرتبط

### مشکل فعلی
`handleDelete` فقط پست‌هایی با همان `image_url` **و** همان `platform` را حذف می‌کند. پس اگر یک محتوا روی فیسبوک، اینستاگرام و لینکدین باشد، حذف کارت فیسبوک فقط پست‌های فیسبوک را پاک می‌کند و بقیه باقی می‌مانند و ممکن است پابلیش شوند.

### تغییر

**`src/components/social/PostReviewPanel.tsx`** — آپدیت `handleDelete`:

فیلتر batch را تغییر می‌دهیم تا **تمام پست‌ها با همان `image_url` یا همان `title`** (بدون محدودیت پلتفرم) حذف شوند:

```typescript
const handleDelete = async () => {
  setDeleting(true);
  try {
    // Find ALL related posts across ALL platforms
    const batchPosts = allPosts.filter(p =>
      (post.image_url && p.image_url === post.image_url) ||
      (post.title && p.title === post.title)
    );
    const toDelete = batchPosts.length > 0 ? batchPosts : [post];
    
    for (const p of toDelete) {
      await deletePost.mutateAsync(p.id);
    }
    toast({ title: "Deleted", description: `${toDelete.length} post(s) deleted across all platforms.` });
  } finally {
    setDeleting(false);
    onClose();
  }
};
```

این تغییر باعث می‌شود:
- وقتی یک کارت حذف شود، تمام کپی‌های آن روی تمام پلتفرم‌ها و پیج‌ها حذف شوند
- هیچ پست زمان‌بندی‌شده‌ای باقی نماند که بعداً پابلیش شود

فقط یک فایل تغییر می‌کند: `PostReviewPanel.tsx`

