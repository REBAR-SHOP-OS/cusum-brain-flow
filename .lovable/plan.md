

# اصلاح فیلتر CUTTER-02: فقط ≥ 20M

## مشکل شناسایی‌شده
پلن "Ashok Leyland" شامل آیتم‌های 10M، 15M و 20M است که همگی به CUTTER-02 اختصاص داده شده. فیلتر UI آیتم‌های 10M/15M را مخفی می‌کند، اما مشکل اصلی در **مسیریابی خودکار** است:

- خط ۳۱۷-۳۱۸ در `ShopFloorProductionQueue.tsx`: اگر یک پلن ترکیبی (10M + 20M) باشد، `allSmall = false` → همه به CUTTER-02 می‌رود
- آیتم‌های 10M/15M باید به CUTTER-01 بروند، نه CUTTER-02

## راه‌حل — ۳ تغییر

### ۱. اصلاح Auto-Routing: تقسیم پلن‌های ترکیبی
**فایل:** `src/components/shopfloor/ShopFloorProductionQueue.tsx`

به جای ارسال کل پلن به یک دستگاه، اگر پلن ترکیبی باشد:
- آیتم‌های 10M/15M → تغییر `machine_id` به CUTTER-01 (در سطح آیتم یا ساخت پلن جداگانه)
- آیتم‌های ≥20M → CUTTER-02

چون `cut_plans` فقط یک `machine_id` دارد، بهترین راه: **split the plan** — یک پلن جدید برای آیتم‌های کوچک ایجاد شود.

### ۲. اصلاح `useStationData.ts` — فیلتر plans به machine_id فعلی
**فایل:** `src/hooks/useStationData.ts` (خط ۹۱)

تغییر `.not("machine_id", "is", null)` به `.eq("machine_id", machineId)` تا فقط پلن‌های اختصاص‌یافته به همین دستگاه نمایش داده شوند.

### ۳. اصلاح داده فعلی — انتقال آیتم‌های نادرست
Migration برای تصحیح پلن "Ashok Leyland": آیتم‌های 10M و 15M باید به یک پلن جدید منتقل و به CUTTER-01 اختصاص داده شوند.

## فایل‌ها
1. `src/components/shopfloor/ShopFloorProductionQueue.tsx` — اصلاح auto-routing برای split پلن‌های ترکیبی
2. `src/hooks/useStationData.ts` — فیلتر دقیق‌تر plans
3. DB migration — تصحیح داده فعلی

