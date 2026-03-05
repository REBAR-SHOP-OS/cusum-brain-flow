
این رو دقیقاً در **Run SQL** با محیط **Live** اجرا کن (همین را کپی/پیست کن):

```sql
-- 1) (اختیاری) ببین چه تعداد duplicate داریم
SELECT entity_id, activity_type, summary, due_date, COUNT(*) AS dup_count
FROM public.scheduled_activities
WHERE entity_type = 'lead'
GROUP BY entity_id, activity_type, summary, due_date
HAVING COUNT(*) > 1
ORDER BY dup_count DESC;

-- 2) حذف duplicate ها (یک رکورد جدیدتر نگه می‌دارد)
DELETE FROM public.scheduled_activities
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY entity_id, activity_type, summary, due_date
        ORDER BY created_at DESC, id DESC
      ) AS rn
    FROM public.scheduled_activities
    WHERE entity_type = 'lead'
  ) t
  WHERE rn > 1
);

-- 3) (اختیاری) چک نهایی: باید 0 ردیف برگرداند
SELECT entity_id, activity_type, summary, due_date, COUNT(*) AS dup_count
FROM public.scheduled_activities
WHERE entity_type = 'lead'
GROUP BY entity_id, activity_type, summary, due_date
HAVING COUNT(*) > 1;
```

بعد از اجرای موفق، سریع **Publish** بزن.

نکته مهم: فعلاً `CREATE INDEX` را دستی نزن، چون migration اولیه خودش index را می‌سازد و اگر دستی بسازی، همان migration ممکن است با خطای «already exists» fail شود.
