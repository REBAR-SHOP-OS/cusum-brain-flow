

# چرا "Rebar Cage (Small)" در Pool ‏CUTTER-01 ظاهر نمی‌شود

## ریشه مشکل (دقیقاً از روی داده‌های واقعی DB)

پروژه Northfleet Group در station dashboard دو ردیف نشان می‌دهد:

| ردیف | plan name | status | item phase | bar_code | machine | اثر روی pool |
|------|-----------|--------|------------|----------|---------|--------------|
| 1 | Rebar Cage | **completed** | `complete` | 20M | CUTTER-02 | ✅ تمام شده — درست است |
| 2 | Rebar Cage (Small) | queued | **`cut_done`** ← مشکل | 10M | CUTTER-01 | ❌ در pool نمایش داده نمی‌شود |

**علت دقیق:**  
`useStationData.ts` (خط ۱۰۸) فقط آیتم‌هایی را برای cutter pool می‌آورد که:
```ts
.or("phase.eq.queued,phase.eq.cutting")
```
ولی آیتم تنها در plan ‏"Rebar Cage (Small)" دارای `phase = 'cut_done'` و `completed_pieces = 25 / total_pieces = 25` است — یعنی **قبلاً کامل cut شده** و الان منتظر bender است.

پس CUTTER-01 برای cut هیچ کاری ندارد، اما plan هنوز `status='queued'` دارد چون trigger `auto_advance_item_phase` فقط `phase` آیتم را به `cut_done` پیش برده، ولی plan را هنوز complete نکرده (احتمالاً منتظر phase نهایی کل آیتم‌هاست — و این تنها آیتم plan است).

دو ناسازگاری اینجا داریم:

1. **Production Queue (شکل ۱) و Station Dashboard (شکل ۲)** plan را به‌صورت `queued` نشان می‌دهند — درست، چون plan هنوز `completed` نشده.
2. **CUTTER-01 Pool (شکل ۳)** آیتمی نشان نمی‌دهد — درست، چون آیتم cut شده و در `cut_done` است.

پس باگ نیست در نمایش pool. ولی **این UX گمراه‌کننده است**: کاربر می‌بیند plan در صف "queued" است، انتظار دارد روی cutter ظاهر شود، ولی نیست.

## رفع — دو لایه

### A) تصحیح وضعیت plan (data fix)
`Rebar Cage (Small)` تمام آیتم‌هایش `phase=cut_done` با `completed_pieces == total_pieces` دارند.  
plan باید روی **cut_done / awaiting_bender** برود نه `queued`.

اضافه کردن منطق در `auto_advance_item_phase` (یا یک trigger مکمل روی `cut_plan_items`) که:  
- وقتی همه آیتم‌های یک plan به `phase=cut_done` رسیدند، اگر هیچ آیتمی نیاز به bend ندارد → plan را `completed` کند.
- اگر آیتم bend دارد → plan را روی `cut_done` (یا یک status جدید مثل `awaiting_bend`) قرار دهد، نه `queued`.

### B) شفاف کردن Station Dashboard و Production Queue UI
در `ShopFloorProductionQueue.tsx` و station dashboard، اگر همه آیتم‌های plan در فاز `cut_done` یا جلوتر هستند، badge را به‌جای **"Queued"** به یکی از این‌ها تبدیل کنیم:
- "Cut Done — Awaiting Bend" (وقتی آیتم bend دارد)
- "Awaiting QC / Clearance" (وقتی فقط منتظر تأیید است)

تغییر فقط در derive کردن label نمایشی — نه تغییر در DB یا منطق pool.

### C) اصلاح فوری برای این رکورد خاص
بعد از migration:  
- update کردن `cut_plans.status='completed'` برای plan ‏`Rebar Cage (Small)` (id `15d0eb9d-...`)  
- یا اگر اقلامش نیاز به bend دارند، `status='cut_done'`

(آیتم `bend_type` تنها آیتم را بررسی می‌کنیم تا تصمیم درست بگیریم.)

## محدوده تغییر

تغییر می‌کند:
- یک migration: تابع/trigger `auto_advance_plan_status` که status plan را بر اساس phase آیتم‌ها sync می‌کند
- یک migration data-fix: به‌روزرسانی این plan خاص
- `ShopFloorProductionQueue.tsx` — derive کردن label واقعی از phase آیتم‌ها
- `StationDashboard.tsx` (یا کامپوننت row آن) — همان

تغییر **نمی‌کند:**
- `useStationData.ts` (منطق pool درست است)
- `CutterStationView`، `CutEngine`، یا هر منطق cut/bend
- RLS، schema جداول، یا Cut Engine

## مراحل اجرا (پس از تأیید)

1. بررسی `bend_type` آیتم plan ‏`Rebar Cage (Small)` تا تصمیم درست (cut_done یا completed) گرفته شود
2. صدور migration:
   - یک trigger AFTER UPDATE روی `cut_plan_items.phase` که اگر همه آیتم‌های plan کامل cut شدند، `cut_plans.status` را به `cut_done`/`completed` پیش ببرد (idempotent)
   - data-fix یک‌باره برای این plan خاص
3. آپدیت `ShopFloorProductionQueue.tsx`:
   - دریافت aggregate phase آیتم‌ها و نمایش label واقعی
4. آپدیت row component `StationDashboard` به همان روش
5. تست end-to-end:
   - رفرش station dashboard → "Rebar Cage (Small)" باید "Cut Done — Awaiting Bend" یا "Done" نشان دهد
   - CUTTER-01 pool خالی بماند (درست است)
   - bender pool باید این آیتم را داشته باشد (اگر bend است)

## اعتبارسنجی

- ✅ plan ‏"Rebar Cage (Small)" دیگر در queue station dashboard به‌عنوان Queued نمایش داده نمی‌شود
- ✅ status plan با phase واقعی آیتم‌ها sync است
- ✅ هیچ تغییری در رفتار CUTTER-01 pool یا Cut Engine نیست
- ✅ گزارش کاربر برطرف می‌شود: cutter پروژه‌های آماده‌ی واقعی را نشان می‌دهد، نه plansی که قبلاً cut شده‌اند

