

# رفع Publish Blocker — تغییر در ۳ فایل migration

## مشکل
Migration `20260305000039` اول اجرا می‌شود و بدون حذف رکوردهای تکراری سعی در ساخت unique index دارد. دو migration بعدی (`175234` و `182054`) که dedup را انجام می‌دهند، **بعد** از آن اجرا می‌شوند پس بی‌فایده‌اند.

## راه‌حل
1. **`20260305000039_...sql`**: dedup + DROP IF EXISTS + CREATE UNIQUE INDEX را همه در همین فایل قرار بده (بدون وابستگی به migrationهای بعدی).
2. **`20260305175234_...sql`**: تبدیل به `SELECT 1;` (no-op)
3. **`20260305182054_...sql`**: تبدیل به `SELECT 1;` (no-op)

### محتوای نهایی `20260305000039`:
```sql
-- Dedup before index creation
DELETE FROM public.scheduled_activities WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY entity_id, activity_type, summary, due_date
      ORDER BY created_at DESC, id DESC
    ) AS rn FROM public.scheduled_activities
    WHERE entity_type = 'lead'
  ) t WHERE rn > 1
);

DROP INDEX IF EXISTS idx_scheduled_activities_dedup;

CREATE UNIQUE INDEX idx_scheduled_activities_dedup
ON public.scheduled_activities (entity_id, activity_type, summary, due_date)
WHERE entity_type = 'lead';
```

هیچ تغییر دیگری لازم نیست. بعد از این، Publish باید بدون خطا اجرا شود.

