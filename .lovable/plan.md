

## حذف کامل آیتم‌های پیش‌فرض با کلیک روی سطل آشغال

### مشکل
وقتی سطل آشغال زده می‌شود، رکورد از دیتابیس حذف می‌شود ولی چون آیتم در لیست پیش‌فرض (`COMPANY_DEFAULTS`) هاردکد شده، دوباره ظاهر می‌شود. همچنین آیتم‌هایی که هنوز رکوردی در دیتابیس ندارند اصلاً دکمه سطل آشغال ندارند.

### راه‌حل
از مکانیزم `is_rejected` که قبلاً وجود دارد استفاده کنیم — فیلتر خط ۲۰۷ آیتم‌های rejected را مخفی می‌کند.

**فایل: `src/components/purchasing/CompanyDefaultItems.tsx`**

1. دکمه سطل آشغال را برای **همه** آیتم‌های پیش‌فرض نمایش بده (نه فقط آنهایی که `dbMatch` دارند)
2. وقتی کلیک می‌شود:
   - اگر `dbMatch` وجود دارد → `onToggleRejected(dbMatch.id, false)` را صدا بزن (آیتم rejected شود)
   - اگر `dbMatch` وجود ندارد → `onMarkRejected(def.title, def.category)` را صدا بزن (رکورد جدید با `is_rejected=true` بسازد)

**فایل: `src/hooks/usePurchasingList.ts`**

3. تابع `toggleRejected` را اصلاح کن: به جای **حذف** رکورد، فیلد `is_rejected` را toggle کند (مشابه `togglePurchased`)

