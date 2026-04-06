

# حذف لغو خودکار ران‌ها بر اساس محدودیت زمانی

## مشکل
سه نقطه در کد، ران‌های فعال را بر اساس مدت زمان (30 دقیقه یا 60 دقیقه) به صورت خودکار کنسل می‌کنند. این باعث کنسل شدن ران‌هایی می‌شود که واقعاً هنوز در حال اجرا هستند.

## تغییرات

### 1. `supabase/functions/manage-machine/index.ts` — حذف شرط stale از startRun

**خط ~160**: حذف `STALE_THRESHOLD_MS` و `isStale` از بلاک startRun. فقط `isOrphan`، `isInactive` و `activeJobDone` باقی بمانند.

**خط ~357**: حذف `STALE_THRESHOLD_MS` و `isStale` از بلاک startQueuedRun. فقط `isOrphan` و `isInactive` باقی بمانند.

تغییرات:
- حذف `const STALE_THRESHOLD_MS = 30 * 60 * 1000;` (دو جا)
- حذف `const isStale = ...` (دو جا)
- حذف `isStale` از شرط `if` و از `reason` logic
- حذف `isStale` از `logProductionEvent` payload

### 2. `src/components/shopfloor/CutterStationView.tsx` — حذف شرط stale از client

**خط ~110-112**: حذف شرط زمانی `isStale` از restore logic. فقط وضعیت‌های غیرفعال (`runErr || !runRow || runRow.status !== "running"`) چک شوند.

تغییرات:
- حذف `const isStale = runRow?.status === "running" && ...`
- حذف `|| isStale` از شرط `if`

## آنچه حفظ می‌شود
- Orphan recovery (ران بدون رکورد در DB) — **بدون تغییر**
- Inactive recovery (ران با وضعیت paused/completed/canceled) — **بدون تغییر**
- Active job done recovery — **بدون تغییر**

## نتیجه
- هیچ رانی فقط به دلیل طولانی بودن زمان کنسل نمی‌شود
- ران‌های واقعی می‌توانند ساعت‌ها فعال بمانند بدون اینکه سیستم آن‌ها را کنسل کند

