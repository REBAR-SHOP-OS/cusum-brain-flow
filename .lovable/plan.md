

# مسیر B — اصلاح ریشه‌ای: حفاظت دفاعی + پاک‌سازی داده‌های legacy

## یافتهٔ مهم پس از بررسی DB زنده

تابع `auto_advance_item_phase` در حال حاضر **درست است** و آیتم‌های straight را به `clearance` می‌فرستد، نه `complete`:
```sql
IF NEW.bend_type = 'bend' THEN NEW.phase := 'cut_done';
ELSE NEW.phase := 'clearance';
```

هر سه ردیف A2001 که الان روی `phase='complete'` گیر کرده‌اند، `ready_at = 2026-04-20 21:05:37` دارند — **دقیقاً تایم‌استمپ همان migration**. یعنی این رکوردها قبل از fix پاکسازی trigger به `complete` رفته‌اند و backfill همان migration `ready_at` را پر کرده. این **legacy data** است، نه باگ trigger فعلی.

پس "Path B" به‌شکل اولیه‌اش (بازنویسی trigger) لازم نیست. به‌جایش دو کار درست:

## تغییرات (یک migration)

### ۱. سخت‌سازی دفاعی trigger
به همان `auto_advance_item_phase` یک گارد اضافه می‌کنیم تا حتی اگر app کد یا UPDATE دستی، آیتمی را از فازهای `queued/cutting/cut_done/bending` مستقیم به `complete` ببرد، redirect شود به `clearance`:

```sql
-- Defensive guard: never allow direct jump to 'complete' from production phases
IF NEW.phase = 'complete'
   AND TG_OP = 'UPDATE'
   AND OLD.phase IN ('queued','cutting','cut_done','bending') THEN
  NEW.phase := 'clearance';
END IF;
```
این بلاک **قبل از** بلاک "Transition into 'complete' → auto-stage" قرار می‌گیرد تا staging فقط برای transition قانونی `clearance → complete` (از `ClearanceCard`) فعال بماند. مسیر INSERT و transition قانونی از `clearance` دست‌نخورده می‌ماند.

### ۲. پاک‌سازی داده‌های legacy (data update، نه schema)
سه ردیف مارک A2001 که در `complete` گیر کرده‌اند به `clearance` برمی‌گردند تا QC رویشان انجام شود:
```sql
UPDATE public.cut_plan_items
SET phase = 'clearance',
    fulfillment_channel = NULL,
    ready_at = NULL
WHERE id IN (
  '3799e34d-7c8e-4dc2-ab76-2a25d6ccf2f9',
  '69b66d16-077c-4c82-b967-c0262e8bfff3',
  '35530866-f77a-4729-bc2e-87704363029b'
)
AND phase = 'complete'
AND delivery_id IS NULL
AND loading_list_id IS NULL
AND pickup_id IS NULL;
```
شرط‌های `delivery_id/loading_list_id/pickup_id IS NULL` ضمانت می‌کنند هیچ آیتمی که قبلاً به delivery/pickup ربط خورده، عقب کشیده نشود.

## آنچه دست نمی‌خورد

- مسیر قانونی `ClearanceCard` → `phase='complete'` (آنجا `OLD.phase='clearance'` است، گارد فعال نمی‌شود).
- INSERTهای جدید با phase=`complete` (مهاجرت‌های آینده، seed data).
- بلاک staging `fulfillment_channel`/`ready_at`.
- بقیهٔ آیتم‌ها (A1003 در clearance، آیتم‌های queued).
- هیچ schema، RLS، edge function یا UI.

## اعتبارسنجی

1. هر سه ردیف A2001 در **Clearance Station** کنار A1003 ظاهر شوند.
2. روی یکی از آن‌ها از Clearance Station تأیید کن → باید به `complete` برود (مسیر قانونی کار می‌کند).
3. تست منفی (اختیاری): `UPDATE cut_plan_items SET phase='complete' WHERE id=<آیتم در فاز cutting>` → باید به `clearance` redirect شود.
4. هیچ آیتم complete موجود از queue تحویل/pickup حذف نشده باشد.

