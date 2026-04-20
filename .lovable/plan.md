

# مسیریابی خودکار T3/T3A به SPIRAL-01

## هدف
هر آیتم bend که `asa_shape_code` آن **T3** یا **T3A** باشد، **همیشه** به ماشین **SPIRAL-01** (`b0000000-0000-0000-0000-000000000005`, "Circular Spiral Bender") اختصاص داده شود — صرف‌نظر از `machine_capabilities`.

## ریشه فعلی
تابع `auto_create_bend_batch` (تریگر روی `cut_batches`) ماشین را فقط بر اساس `machine_capabilities (process='bend' AND bar_code=...)` انتخاب می‌کند. جدول `machine_capabilities` اصلاً ستون shape ندارد، پس تطبیق shape ممکن نیست و T3/T3A ممکن است به یک bender معمولی برود یا بدون ماشین (NULL) بماند.

## رفع

### A) آپدیت `auto_create_bend_batch` با اولویت shape
قبل از انتخاب از `machine_capabilities`، اگر shape آیتم در لیست spiral است → مستقیم SPIRAL-01 برای همان company انتخاب شود:

```sql
-- Spiral shapes always go to the company's spiral bender
IF UPPER(COALESCE(v_item.asa_shape_code, '')) IN ('T3', 'T3A') THEN
  SELECT id INTO v_machine_id
    FROM public.machines
   WHERE company_id = NEW.company_id
     AND name = 'SPIRAL-01'
   LIMIT 1;
END IF;

-- Fallback: capability-based assignment (only if not a spiral shape)
IF v_machine_id IS NULL THEN
  SELECT mc.machine_id INTO v_machine_id
    FROM public.machine_capabilities mc
    JOIN public.machines m ON m.id = mc.machine_id
   WHERE mc.process = 'bend'
     AND mc.bar_code = v_item.bar_code
     AND m.company_id = NEW.company_id
   LIMIT 1;
END IF;
```

این منطق case-insensitive است (`UPPER(...)`) و فقط برای shapeهای spiral (T3/T3A) اعمال می‌شود.

### B) Backfill: re-route آیتم‌های T3/T3A موجود
هر `bend_batch` فعلی که shape آن T3/T3A است و هنوز `queued` (یعنی شروع نشده) → machine_id آن به SPIRAL-01 آپدیت شود:

```sql
UPDATE public.bend_batches bb
   SET machine_id = (
     SELECT id FROM public.machines
      WHERE company_id = bb.company_id AND name = 'SPIRAL-01' LIMIT 1
   )
 WHERE UPPER(COALESCE(bb.shape, '')) IN ('T3', 'T3A')
   AND bb.status = 'queued';
```

batchهای در حال bending یا کامل‌شده دست‌نخورده می‌مانند.

## محدوده تغییر

تغییر می‌کند:
- یک migration جدید SQL:
  - `CREATE OR REPLACE FUNCTION public.auto_create_bend_batch()` با منطق spiral-priority
  - یک‌بار `UPDATE` روی `bend_batches` در حالت `queued`

تغییر **نمی‌کند:**
- هیچ کد frontend
- ساختار جدول `machines`, `bend_batches`, `machine_capabilities`
- تریگر یا تابع‌های دیگر
- batchهای در حال انجام یا کامل‌شده

## اعتبارسنجی
- ✅ هر cut batch جدیدی که آیتم آن T3 یا T3A است، خودکار `bend_batches.machine_id = SPIRAL-01` می‌گیرد
- ✅ آیتم‌های موجود T3/T3A در حالت queued به SPIRAL-01 منتقل می‌شوند
- ✅ shapeهای غیر-spiral همان منطق capability قبلی را دنبال می‌کنند
- ✅ پنل SPIRAL-01 (که از `useBenderBatches` می‌خواند) آیتم‌های spiral را نشان می‌دهد
- ✅ Trigger idempotent باقی می‌ماند

