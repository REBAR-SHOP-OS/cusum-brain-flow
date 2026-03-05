

# پلن: Select All + رفع Delete + رفع بلاکر Publish

## ۱. رفع بلاکر Publish (اقدام دستی شما روی Live)

Migration `20260305000039` یک unique index روی `scheduled_activities` می‌سازد اما رکوردهای تکراری در Live وجود دارند. باید این SQL را در **Backend View → Run SQL → Live** اجرا کنید:

```sql
DELETE FROM public.scheduled_activities WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY entity_id, activity_type, summary, due_date
      ORDER BY created_at DESC, id DESC
    ) AS rn FROM public.scheduled_activities
    WHERE entity_type = 'lead'
  ) t WHERE rn > 1
);
```

بعد از اجرا، Publish کنید.

---

## ۲. رفع مشکل Delete (RLS Policy)

**مشکل اصلی**: policy DELETE روی `deliveries` فقط `admin` را مجاز می‌کند. همچنین policy UPDATE روی `deliveries` شامل `workshop` نیست. بنابراین کاربران workshop نمی‌توانند نه status را تغییر دهند و نه حذف کنند.

**راه‌حل**: یک migration جدید:
- DELETE policy روی `deliveries` → اضافه کردن `office`, `field`, `workshop`
- DELETE policy روی `delivery_stops` → اضافه کردن `office`, `field`, `workshop`  
- UPDATE policy روی `deliveries` → اضافه کردن `workshop`

---

## ۳. فیچر Select All + Bulk Delete

در صفحه `DeliveryOps.tsx`:

- **آیکون Select All** در هدر (کنار عنوان): یک checkbox/toggle که تمام کارت‌ها را انتخاب می‌کند
- هر کارت یک **checkbox** دریافت می‌کند برای انتخاب/خروج از انتخاب تکی
- وقتی آیتم‌هایی انتخاب شده‌اند، یک **Bulk Action Bar** ثابت در پایین نمایش داده می‌شود (مشابه `PipelineBulkBar`) با دکمه Delete
- State: `selectedIds: Set<string>` — toggle تکی + select all + clear
- کلیک Select All وقتی همه انتخاب‌اند → deselect all

---

## فایل‌های تغییر یافته
| فایل | تغییر |
|---|---|
| `supabase/migrations/new.sql` | Fix DELETE/UPDATE policies |
| `supabase/migrations/20260305000039_...sql` | Add dedup before index creation |
| `src/pages/DeliveryOps.tsx` | Select All checkbox, per-card checkbox, bulk bar, bulk delete |

