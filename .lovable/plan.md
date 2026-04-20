

# چرا Bender ها هیچ کاری نشان نمی‌دهند بعد از Cut

## ریشه مشکل (تأیید‌شده از DB و کد)

سه تا یافته‌ی قطعی:

1. **جدول `bend_batches` کاملاً خالی است.** کوئری `SELECT COUNT(*) FROM bend_batches` هیچ ردیفی برنمی‌گرداند. کل تاریخچه‌ی production هیچ‌وقت یک bend batch نساخته.

2. **`useBenderBatches` (که `BenderBatchPanel` را تغذیه می‌کند) فقط از `bend_batches` می‌خواند** — با فیلتر `machine_id = X` + `status IN (queued, bending, paused)`. چون جدول خالی است، panel همیشه پیغام **"No bend batches assigned to this machine"** را نشان می‌دهد.

3. **edge function `create-bend-queue` کد دارد ولی هرگز فراخوانی نمی‌شود.** تنها مرجع‌های آن:
   - `manage-bend/index.ts` (router)
   - `manage-bend/handlers/bendQueue.ts` (handler)
   - `manageBendService.ts` (type literal فقط)
   
   هیچ frontend handler، trigger DB، یا cut-completion path آن را صدا نمی‌زند. کاملاً dead code است.

نتیجه: وقتی cutter یک bend item را تمام می‌کند → `cut_plan_items.phase = 'cut_done'` می‌شود (این درست کار می‌کند و در `useStationData` برای bender نمایش داده می‌شود) → اما **هیچ‌وقت یک ردیف در `bend_batches`** ساخته نمی‌شود → `BenderBatchPanel` خالی است.

برای آیتم Northfleet "Rebar Cage (Small)": الان به phase `clearance` رسیده با ۲۵/۲۵ پیس bent، اما هرگز batch‌ای برای آن ثبت نشد.

## رفع

اتصال خودکار: وقتی یک `cut_plan_item` با `bend_type='bend'` به phase `cut_done` می‌رسد، یک `bend_batch` متناظر با `status='queued'` ساخته شود.

### A) DB Trigger جدید (اصل راه‌حل — deterministic)

migration جدید:

```sql
CREATE OR REPLACE FUNCTION public.auto_create_bend_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_machine_id uuid;
BEGIN
  -- Only fire when phase transitions INTO 'cut_done' for bend items
  IF NEW.phase = 'cut_done'
     AND (OLD.phase IS DISTINCT FROM NEW.phase)
     AND NEW.bend_type = 'bend'
  THEN
    -- Skip if a bend_batch already exists (idempotent)
    IF EXISTS (
      SELECT 1 FROM public.bend_batches
      WHERE source_cut_batch_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    -- Resolve company_id from cut_plan
    SELECT company_id INTO v_company_id
    FROM public.cut_plans WHERE id = NEW.cut_plan_id;

    -- Best-effort machine assignment: first bender with capability for this bar_code
    SELECT mc.machine_id INTO v_machine_id
    FROM public.machine_capabilities mc
    JOIN public.machines m ON m.id = mc.machine_id
    WHERE mc.process = 'bend'
      AND mc.bar_code = NEW.bar_code
      AND m.company_id = v_company_id
    LIMIT 1;

    INSERT INTO public.bend_batches (
      company_id, source_cut_batch_id, source_job_id,
      machine_id, shape, size, planned_qty, status
    ) VALUES (
      v_company_id, NEW.id, NEW.cut_plan_id,
      v_machine_id, NEW.asa_shape_code, NEW.bar_code,
      COALESCE(NEW.total_pieces, 0), 'queued'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_bend_batch ON public.cut_plan_items;
CREATE TRIGGER trg_auto_create_bend_batch
AFTER UPDATE OF phase ON public.cut_plan_items
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_bend_batch();
```

**ویژگی‌ها:**
- فقط روی transition `* → cut_done` فعال می‌شود (نه هر update)
- فقط برای آیتم‌های `bend_type='bend'` (آیتم‌های straight ندارند)
- Idempotent: اگر batch قبلاً ساخته شده، دوباره نمی‌سازد
- machine_id بر اساس `machine_capabilities` (فرآیند bend + bar_code منطبق) خودکار assign می‌شود
- اگر هیچ bender بدردبخوری نبود → `machine_id = NULL` → batch همچنان ساخته می‌شود و در صفحه‌ی `BendQueueAdmin` قابل assign دستی است

### B) Backfill برای آیتم‌های موجود

برای آیتم‌هایی که الان در phase `cut_done` (یا بعدش) هستند ولی batch ندارند:

```sql
INSERT INTO public.bend_batches
  (company_id, source_cut_batch_id, source_job_id, machine_id, shape, size, planned_qty, status)
SELECT
  cp.company_id,
  cpi.id,
  cpi.cut_plan_id,
  (SELECT mc.machine_id FROM machine_capabilities mc
     JOIN machines m ON m.id = mc.machine_id
    WHERE mc.process = 'bend' AND mc.bar_code = cpi.bar_code
      AND m.company_id = cp.company_id LIMIT 1),
  cpi.asa_shape_code,
  cpi.bar_code,
  COALESCE(cpi.total_pieces, 0),
  CASE
    WHEN cpi.bend_completed_pieces >= cpi.total_pieces THEN 'bend_complete'
    WHEN cpi.bend_completed_pieces > 0 THEN 'bending'
    ELSE 'queued'
  END
FROM public.cut_plan_items cpi
JOIN public.cut_plans cp ON cp.id = cpi.cut_plan_id
WHERE cpi.bend_type = 'bend'
  AND cpi.phase IN ('cut_done', 'bending', 'clearance', 'complete')
  AND NOT EXISTS (
    SELECT 1 FROM public.bend_batches bb WHERE bb.source_cut_batch_id = cpi.id
  );
```

این فقط batchهای از دست رفته (مثل "Rebar Cage (Small)" Northfleet) را از روی state فعلی می‌سازد. هیچ آیتم production فعلی را تغییر نمی‌دهد.

## محدوده تغییر

تغییر می‌کند:
- یک migration جدید SQL با:
  - تابع `auto_create_bend_batch` + trigger روی `cut_plan_items`
  - backfill INSERT یک‌باره

تغییر **نمی‌کند:**
- هیچ کد frontend (هیچ فایل .tsx لمس نمی‌شود)
- هیچ edge function
- منطق `auto_advance_item_phase` (همان دست‌نخورده می‌ماند)
- جریان cutter یا production queue
- RLS یا access control (trigger به‌عنوان SECURITY DEFINER اجرا می‌شود)
- کد `create-bend-queue` در `manage-bend` (همچنان برای ساخت دستی در آینده در دسترس است)

## مراحل اجرا

1. اجرای migration: تابع + trigger + backfill
2. بررسی: کوئری `SELECT count(*) FROM bend_batches` باید رقم > 0 برگرداند
3. تست end-to-end:
   - یک آیتم bend جدید را در cutter تمام کن → خودکار باید یک ردیف queued در `bend_batches` ساخته شود
   - به BENDER-01 برو → باید بخش "Bend Batches" آن آیتم را نشان دهد با دکمه START

## اعتبارسنجی

- ✅ آیتم‌های قدیمی Northfleet (Rebar Cage Small) که قبلاً bend شده‌اند → backfill با status `bend_complete` ثبت می‌شوند
- ✅ آیتم‌های bend جدیدی که cut آنها تمام می‌شود → خودکار با status `queued` در `bend_batches` ظاهر می‌شوند
- ✅ صفحه‌ی Bender Station بلافاصله (با realtime موجود در `useBenderBatches`) batchها را نشان می‌دهد
- ✅ هیچ rollback یا تغییری در آیتم‌های production فعلی رخ نمی‌دهد
- ✅ Trigger idempotent است → اجرای دوباره backfill duplicate نمی‌سازد

