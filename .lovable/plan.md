

# چرا "Cut Done — Awaiting Bend" ولی هیچ Bender نشانش نمی‌دهد

## ریشه مشکل (تأیید‌شده از DB)

پنج تا cut_plan_item با phase `cut_done` و bend_type=`bend` در DB هست (A1509, A1505, A1502×2, A1503 — همگی shape 17/20, 15M) که **هیچ ردیف `cut_batches`** برایشان ساخته نشده.

تریگر فعلی `auto_create_bend_batch` **روی `cut_batches` AFTER UPDATE** فایر می‌شود (status → completed). اگر cutter آیتم را بدون insert در `cut_batches` به phase `cut_done` پیش ببرد (مسیر `auto_advance_item_phase` فقط روی `cut_plan_items.phase` کار می‌کند، مستقل از batch insert)، تریگر هرگز اجرا نمی‌شود → `bend_batches` خالی می‌ماند → `useBenderBatches` (که فقط از `bend_batches` می‌خواند) چیزی نشان نمی‌دهد.

نشانه‌ای که در تصویر می‌بینید: badge **"Cut Done — Awaiting Bend"** از روی `cut_plan_items.phase` می‌آید (درست). ولی پنل bender از روی `bend_batches` می‌آید (خالی).

(آیتم Northfleet "Rebar Cage (Small)" که در تصویر دور آن خط کشیدی، A1003/T3 است که الان phase=clearance و قبلاً bend شده — این از قبل OK است. مشکل واقعی روی ۵ آیتم 15M shape 17/20 است.)

## رفع (دو لایه — هر دو لازم)

### A) تریگر دومی روی `cut_plan_items.phase` (پوشش مسیر phase-only)

migration جدید اضافه می‌کند: تابع `auto_create_bend_batch_from_phase` و تریگر `trg_auto_create_bend_batch_from_phase` روی `cut_plan_items` AFTER UPDATE OF phase.

منطق:
- فایر فقط روی transition `* → cut_done` و فقط برای `bend_type='bend'`
- idempotent: اگر `bend_batches.source_cut_batch_id` یا یک batch با `(company_id, source_job_id=cut_plan_id, shape, size)` مشابه از قبل هست، skip
- machine_id با همان منطق spiral-priority:
  - اگر `UPPER(asa_shape_code) IN ('T3','T3A')` → SPIRAL-01
  - وگرنه از `machine_capabilities (process='bend' AND bar_code=...)`
  - اگر هیچ‌کدام → NULL (در BendQueueAdmin قابل assign دستی)
- `source_cut_batch_id = NULL` (چون cut_batch نداریم)، `source_job_id = cut_plan_id`، `planned_qty = COALESCE(total_pieces,0)`
- status بر اساس `bend_completed_pieces` هوشمند انتخاب می‌شود (مثل backfill قبلی)

تریگر اولی (روی `cut_batches`) دست‌نخورده باقی می‌ماند تا مسیر batch-driven همچنان کار کند. هر دو تریگر idempotent هستند پس duplicate ساخته نمی‌شود.

### B) Backfill برای ۵ آیتم بلاتکلیف فعلی

INSERT یک‌باره از `cut_plan_items WHERE phase IN ('cut_done','bending','clearance') AND bend_type='bend' AND NOT EXISTS (bend_batch با همان source_job_id+shape+size)` با همان منطق machine assignment بالا.

این فقط برای آیتم‌های گم‌شده ردیف می‌سازد، وضعیت phase آیتم‌ها را تغییر نمی‌دهد.

## محدوده تغییر

تغییر می‌کند:
- یک migration جدید SQL با:
  - تابع `auto_create_bend_batch_from_phase` + تریگر روی `cut_plan_items`
  - INSERT backfill یک‌باره برای آیتم‌های موجود

تغییر **نمی‌کند:**
- تریگر فعلی روی `cut_batches` (هنوز برای مسیر batch-driven استفاده می‌شود)
- منطق spiral routing (T3/T3A → SPIRAL-01) دقیقاً تکرار می‌شود
- هیچ کد frontend
- ساختار جداول
- RLS / access control
- `auto_advance_item_phase` و سایر تریگرهای production

## اعتبارسنجی
- ✅ بعد از migration: ۵ ردیف جدید در `bend_batches` با status=queued ظاهر می‌شود (bf913dd8 / shape 20 → BENDER-01 یا 02 طبق capability؛ shape 17 → bender معمولی)
- ✅ پنل BENDER-01/02/03 آیتم‌های 15M را نشان می‌دهد (با realtime موجود در `useBenderBatches`)
- ✅ هیچ آیتم T3/T3A در bender معمولی نمی‌رود
- ✅ آیتم‌های جدیدی که cutter از مسیر phase-only پیش می‌برد، خودکار به bend_batches می‌روند
- ✅ آیتم‌های با مسیر batch-driven (cut_batches.status=completed) همچنان کار می‌کنند، duplicate نمی‌سازد
- ✅ هیچ تغییری در آیتم‌های production فعلی یا جریان cutter

