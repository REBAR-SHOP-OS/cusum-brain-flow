

# اصلاح گروه‌بندی Clearance Station — یک پروژه، نه دو

## ریشهٔ مشکل
`Rebar Cage` و `Rebar Cage (Small)` هر دو **متعلق به همان پروژه** (`Innis College`, project_id `e11ffd9f…`) هستند، اما در Clearance Station به‌صورت دو manifest جدا دیده می‌شوند چون:

- در `useClearanceData.ts` خط ۸۲ و ۱۱۵، برچسبِ گروه از فیلد denormalized **`cut_plans.project_name`** خوانده می‌شود (نه از join واقعی `projects`).
- داده‌های فعلی این فیلد را غلط دارند:
  - Plan `Rebar Cage` → `project_name = 'Rebar Cage'` (همان نام plan، اشتباه)
  - Plan `Rebar Cage (Small)` → `project_name = NULL` → fallback به `plan_name`
- نتیجه: دو لیبل متفاوت → دو ردیف در UI.

## اصلاح (فقط همین یک hook)
**فایل:** `src/hooks/useClearanceData.ts`

۱. **Join واقعی به `projects`** برای گرفتن نام معتبر پروژه:
```ts
.select("*, cut_plans!inner(id, name, project_id, company_id, projects(id, name))")
```

۲. در map خط ۶۹–۹۰، فیلد `project_name` از `item.cut_plans.projects?.name` خوانده شود (نه از `cut_plans.project_name` denormalized). همچنین اضافه‌کردن `project_id` به interface برای کلید گروه‌بندی پایدار.

۳. در گروه‌بندی خط ۱۱۱–۱۲۹:
   - کلید group: **`project_id`** (نه `cut_plan_id`).
   - label: `projects.name` (یعنی `Innis College`).
   - آیتم‌های هر دو plan تحت یک کارت تجمیع می‌شوند.

۴. آیتم‌های بدون `project_id` (orphan) همچنان زیر `Unassigned` گروه می‌خورند.

## چه چیزی دست نمی‌خورد
- `ClearanceStation.tsx`: تغییر نمی‌کند (همان `byProject: Map<string, ClearanceItem[]>` را مصرف می‌کند).
- `ClearanceCard.tsx`، RLS، schema، migrationها، realtime channel.
- بقیهٔ hookها (`useReadyToShip`, `useProductionQueues`, …).
- داده در DB: فیلد `cut_plans.project_name` همچنان همان مقدار غلط را دارد ولی دیگر منبع حقیقت نیست (اصلاح آن یک data-cleanup جداگانه است که در این تغییر لازم نیست).

## اعتبارسنجی
1. در Clearance Station باید فقط یک کارت **«INNIS COLLEGE»** برای این پروژه دیده شود — شامل هر دو مارک‌ست (A1003 + A2001) با شمارش تجمیعی (مثلاً `3/4`).
2. کارت‌های بقیهٔ پروژه‌ها (CAGES, J-HOOKS, R01, …) دست‌نخورده باقی بمانند.
3. شمارهٔ هدر `3 / 7 Cleared` تغییر نمی‌کند (فقط نحوهٔ گروه‌بندی عوض می‌شود، نه تعداد آیتم‌ها).

