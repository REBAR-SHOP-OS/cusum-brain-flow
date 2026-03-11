

## مشکل: حذف پست فقط یکی از پست‌های گروه را پاک می‌کند

### علت اصلی
وقتی روی کارت فیسبوک (×4) کلیک می‌کنید، پنل باز می‌شود و دکمه «Delete post» فقط **یک پست** (`post.id`) را حذف می‌کند. اما 3 پست دیگر (برای صفحات مختلف فیسبوک) در دیتابیس باقی می‌مانند و کارت همچنان در تقویم نمایش داده می‌شود.

قابلیت تایید نیل (`Neel Approval`) از منطق batch استفاده می‌کند (همه پست‌های هم‌گروه را پیدا و آپدیت می‌کند) ولی `handleDelete` این کار را نمی‌کند.

### تغییر

**`src/components/social/PostReviewPanel.tsx`** — آپدیت `handleDelete` برای حذف دسته‌ای:

```typescript
const handleDelete = async () => {
  setDeleting(true);
  try {
    // Find all posts in this group (same image/content batch)
    const batchPosts = post.image_url
      ? allPosts.filter(p => p.image_url === post.image_url && p.platform === post.platform)
      : [post];
    for (const p of batchPosts) {
      await deletePost.mutateAsync(p.id);
    }
    toast({ title: "Deleted", description: `${batchPosts.length} post(s) deleted.` });
  } finally {
    setDeleting(false);
    onClose();
  }
};
```

این تغییر باعث می‌شود وقتی «Delete post» زده می‌شود، تمام پست‌های آن گروه (مثلاً هر 4 پست فیسبوک) حذف شوند و کارت از تقویم ناپدید شود.

