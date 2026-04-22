

# ادغام واقعی plan «(Small)» با plan والد در DB

## یافتهٔ DB

دو plan «(Small)» در کل سیستم وجود دارد، هر دو با `barlist_id = NULL` و `status = completed`:

| ID والد (با barlist_id) | ID «(Small)» (بدون barlist_id) | پروژه | آیتم‌ها در (Small) | clearance_evidence |
|---|---|---|---|---|
| `4f3569a4` Rebar Cage | `8cb4dee1` Rebar Cage (Small) | Innis College | ۱ (A1003) | ۳ |
| `d5c0d80e` GRADE BEAM 1 + LOOSE REBAR | `668a2d3f` GRADE BEAM 1 + LOOSE REBAR (Small) | 505 Glenlake | ۴ (A1001, cage) | ۱ |

دیگر downstreamها (`cut_output_batches`, `inventory_reservations`, `loading_checklist`, deliveries) صفر — ادغام امن است. در کد هیچ‌جا plan «(Small)» تولید نمی‌شود (legacy data، نه pipeline فعال).

## تغییر (یک data migration، بدون schema change)

برای هر جفت:
1. **انتقال آیتم‌ها**: `UPDATE cut_plan_items SET cut_plan_id = <والد> WHERE cut_plan_id = <(Small)>` — این کار `clearance_evidence` را خودکار با خود می‌برد چون evidence به `cut_plan_item_id` چسبیده، نه `cut_plan_id`.
2. **حذف plan خالی «(Small)»**: `DELETE FROM cut_plans WHERE id IN ('8cb4dee1…', '668a2d3f…') AND NOT EXISTS (SELECT 1 FROM cut_plan_items WHERE cut_plan_id = cut_plans.id)`.

محدودسازی: فقط همین دو ID صریح؛ هیچ pattern matching روی `name LIKE '% (Small)'` تا اگر روزی plan قانونی با این اسم ساخته شود، اشتباه پاک نشود.

## چه چیزی دست نمی‌خورد

- `ProductionQueueView.tsx`، `useClearanceData.ts`، RLS، schema، triggers، edge functions.
- `clearance_evidence` ردیف‌ها (همراه آیتم منتقل می‌شوند، رابطه پایدار).
- plan‌های والد (`4f3569a4`, `d5c0d80e`) — فقط `item_count` آن‌ها افزایش می‌یابد.
- بقیهٔ پروژه‌ها (CAGES, J-HOOKS, R01, …).

## اعتبارسنجی

1. در `/office` → Production Queue: ذیل barlist «Rebar Cage» فقط یک ردیف (نه دو) و ذیل barlist «GRADE BEAM 1 + LOOSE REBAR» فقط یک ردیف.
2. در Clearance Station: کارت INNIS COLLEGE همچنان شامل A1003 + A2001 (هر دو زیر همان manifest والد، نه دو plan).
3. شمارش‌ها: plan والد `Rebar Cage` آیتم‌ها = ۲ (A2001 + A1003)، plan والد `GRADE BEAM 1 + LOOSE REBAR` آیتم‌ها = ۸ (۴ قبلی + ۴ منتقل‌شده).
4. هیچ ردیف بی‌پدر در `cut_plan_items` یا `clearance_evidence`.

