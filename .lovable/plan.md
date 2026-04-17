
## ریشه‌ی مسئله — تأیید‌شده با دیتابیس

پروژه «505 Glenlake» (مشتری The Under Pinners) در DB دقیقاً این داده را دارد:

| منبع | نام | وضعیت | ماشین |
|---|---|---|---|
| **barlists** | GRADE BEAM 1 + LOOSE REBAR (R1) | in_production | — |
| **cut_plans** | GRADE BEAM 1 + LOOSE REBAR | queued | CUTTER-02 |
| **cut_plans** | GRADE BEAM 1 + LOOSE REBAR **(Small)** | queued | CUTTER-01 |

یعنی **۱ barlist + ۲ cut_plan** (که cut_plan دوم به‌صورت auto-split از Small-bars (10M/15M) ساخته شده — منطقی که در `ShopFloorProductionQueue.tsx` خطوط 322-353 وجود دارد).

تفاوت بین سه صفحه ناشی از این است که هر صفحه از منبع داده‌ی متفاوتی می‌خواند و ردیف‌های (Small) را متفاوت فیلتر/نمایش می‌دهد:

### Detailed List → ۱ ردیف
در `DetailedListView.tsx` خط 125:
```ts
for (const plan of plans.filter(p => !p.name.endsWith("(Small)"))) { ... }
```
صریحاً ردیف‌های `(Small)` فیلتر می‌شوند. → فقط plan اصلی نمایش داده می‌شود = **۱**.

### Production Queue (Office) → ۲ ردیف
در `ProductionQueueView.tsx` (تابع `buildProjectNode` خطوط 282-298) cut_plans به barlist match می‌شوند با FK `barlist_id` یا fallback به نام. plan با نام «GRADE BEAM 1 + LOOSE REBAR» داخل barlist match می‌شود (= ۱)، plan با «(Small)» نه FK دارد و نه نام match می‌کند → به‌عنوان `loosePlans` زیر همان پروژه نمایش داده می‌شود (= ۱). جمع: **۲ manifest**.

### Shop Floor Production Queue → ۳ ردیف
در `ShopFloorProductionQueue.tsx` خطوط 237-248:
- اول **همه‌ی barlists** پروژه را render می‌کند (= ۱)
- سپس **همه‌ی cut_plans** پروژه را به‌صورت ردیف‌های جداگانه‌ی `CutPlanRow` در پایین render می‌کند (= ۲)
- جمع: **۳ ردیف** (که در عکس کاربر هم دقیقاً همین است: ۱ FileText icon + ۲ Wrench icons)

تفاوت معماری روشن است: Office دو مفهوم متفاوت (barlist vs cut_plan/manifest) را در یک سلسله‌مراتب **ادغام** می‌کند، اما ShopFloor آن‌ها را **کنار هم** نمایش می‌دهد.

---

## برنامه‌ی اصلاحی (Surgical, Single-File)

برای ایجاد سازگاری بین سه صفحه، فقط `ShopFloorProductionQueue.tsx` را اصلاح می‌کنیم تا با همان منطق Production Queue (Office) رفتار کند:

### تغییر در `src/components/shopfloor/ShopFloorProductionQueue.tsx`

#### ۱. ادغام cut_plans با barlists در `buildProjectNode`
به‌جای render کردن جداگانه‌ی barlists و cut_plans، هر cut_plan را زیر barlist مربوطه‌اش قرار دهیم:
- **Primary match**: `cut_plan.barlist_id === barlist.id`
- **Fallback match**: `cut_plan.name === barlist.name` (برای داده‌ی legacy)
- cut_plans بدون match → به‌عنوان "loose plans" زیر پروژه (مثل Office)

#### ۲. تغییر struct گروه `ProjectGroup`
به جای دو list مجزا (`barlists` + `cutPlans`)، هر barlist شامل `plans: CutPlanForBarlist[]` خواهد بود. UI:
```
📁 505 Glenlake
  📄 GRADE BEAM 1 + LOOSE REBAR  R1  [in_production]
     🔧 GRADE BEAM 1 + LOOSE REBAR        [queued]  CUTTER-02
     🔧 GRADE BEAM 1 + LOOSE REBAR (Small) [queued]  CUTTER-01
```
دو cut_plan به‌صورت children ایندنت‌شده زیر barlist والد نمایش داده می‌شوند، نه به‌صورت ردیف‌های مستقل.

#### ۳. fetch `barlist_id` در query کلی cut_plans
خط 57 query را به این تغییر می‌دهیم:
```ts
.select("id, name, status, machine_id, project_id, barlist_id, machines(name)")
```

#### ۴. حفظ همه‌ی functionality موجود
- `CutPlanRow` (دکمه‌ی Change/Assign machine + auto-assignment logic) — بدون تغییر در منطق
- Auto-split برای Small bars — بدون تغییر
- `BarlistRow` و `StatusBadge` — بدون تغییر

#### ۵. Total در Badge هدر
`{totalBarlists} Barlists` بدون تغییر می‌ماند (همچنان یک تعداد است).

---

## نتیجه پس از اصلاح

برای پروژه «505 Glenlake»، Shop Floor دقیقاً مثل Production Queue (Office) **۱ barlist با ۲ manifest تو در تو** نشان می‌دهد، نه ۳ ردیف مسطح.

| صفحه | قبل | بعد |
|---|---|---|
| Detailed List | ۱ | ۱ (بدون تغییر — منطق `(Small)` فیلتر درست است) |
| Production Queue (Office) | ۲ | ۲ (بدون تغییر) |
| Shop Floor | ۳ ردیف مسطح | ۱ barlist + ۲ manifest تو در تو ✓ |

### آنچه تغییر **نمی‌کند**
- منطق Detailed List و Production Queue (Office) — دست‌نخورده
- منطق auto-assignment ماشین‌ها و Small-split
- DB schema و RLS
- صفحات دیگر Shop Floor

### نکته
اگر کاربر می‌خواهد ردیف‌های `(Small)` در Detailed List هم نمایش داده شوند، آن یک تغییر جداگانه است (حذف فیلتر خط 125). در آن صورت بفرمایید تا به‌صورت option دوم اضافه کنم.
