

## طرح: نمایش همیشگی نام سازنده تسک

### مشکل
در پنل جزئیات تسک (خط ۱۳۰۷)، فیلد "Created By" مستقیماً از `created_by_profile?.full_name` خوانده می‌شود. اگر این فیلد خالی باشد، فقط "—" نمایش داده می‌شود. در حالی که تابع `getTaskCreatorName` وجود دارد که از منابع مختلف (metadata، description، profile) نام سازنده را استخراج می‌کند.

### تغییرات

**فایل: `src/pages/Tasks.tsx`**

۱. **خط ۱۳۰۷** — استفاده از `getTaskCreatorName` به جای دسترسی مستقیم:
```typescript
// قبل:
<p className="mt-0.5 text-sm">{selectedTask.created_by_profile?.full_name || "—"}</p>

// بعد:
<p className="mt-0.5 text-sm">{getTaskCreatorName(selectedTask) || "ناشناس"}</p>
```

۲. **هنگام ایجاد تسک** — اطمینان از اینکه `created_by_profile_id` همیشه ست شود (خط ۸۲۸ — این قبلاً انجام شده). بررسی مسیرهای دیگر ایجاد تسک (مثل feedback tasks، تسک‌های AI) تا همه `created_by_profile_id` داشته باشند.

### نتیجه
نام سازنده هیچ‌وقت خالی نمایش داده نمی‌شود — ابتدا از metadata، سپس description، و در نهایت از profile خوانده می‌شود. اگر هیچ‌کدام موجود نباشد، "ناشناس" نمایش داده می‌شود.

