## مشکل (Root cause)

در `src/components/social/PostReviewPanel.tsx` تابع `handleDelete` (خط ۵۲۲–۵۴۱) عمداً همهٔ پست‌های «خواهر/برادر» (siblings) را که هم‌پلتفرم، هم‌عنوان و هم‌روز هستند پیدا می‌کند و همه را با هم پاک می‌کند:

```ts
const siblings = allPosts.filter(p =>
  p.platform === post.platform &&
  p.title === post.title &&
  p.scheduled_date?.substring(0,10) === postDay
);
const idsToDelete = siblings.length > 0 ? siblings.map(s => s.id) : [post.id];
await Promise.all(idsToDelete.map(id => deletePost.mutateAsync(id)));
```

به همین دلیل وقتی کاربر روی یک کارت Delete می‌زند، تمام پست‌های مشابه آن روز هم پاک می‌شوند.

## رفع باگ (Surgical)

فقط همین تابع را اصلاح می‌کنیم تا فقط همان `post.id` پاک شود — بدون لمس مسیر Bulk Delete یا حذف unassigned.

### تغییرات

1. **`src/components/social/PostReviewPanel.tsx`** — `handleDelete`:
   - حذف منطق siblings.
   - فقط `await deletePost.mutateAsync(post.id)`.
   - پیام toast: `"Post deleted."`.

2. **رگرشن**: افزودن `tests/regression/social/delete-single-card-only.test.ts` که تضمین می‌کند با حذف یک پست، فقط یک id به `deletePost` پاس داده می‌شود حتی وقتی پست‌های دیگری با همان title/platform/date در `allPosts` وجود دارند.

### خارج از scope (بدون تغییر)

- مسیر Bulk Delete (`handleBulkDelete` در `SocialMediaManager.tsx`) دست‌نخورده.
- مسیر `schedulePost({ delete_original: true })` برای unassigned دست‌نخورده.
- منطق RLS، triggerها و workflow gates دست‌نخورده.