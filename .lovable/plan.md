

# تغییرات: دکمه‌های رنگی و شکل متفاوت + حذف فارسی

## مشکلات فعلی
1. آیکون‌های style و product ظاهر ساده دارند — باید شبیه دکمه‌های رنگارنگ شوند
2. Tooltip و label‌ها شامل متن فارسی هستند — باید کاملاً انگلیسی شوند
3. دکمه‌های style همه یک رنگ (primary) دارند — هر کدام باید رنگ مجزا داشته باشند
4. دکمه‌های محصولات باید شکل (shape) متفاوت داشته باشند

## تغییرات

### فایل: `src/components/chat/ChatInput.tsx`

**1. آرایه IMAGE_STYLES:**
- حذف `label` فارسی، فقط `labelEn` (یا `label` انگلیسی) نگه داشته شود
- اضافه کردن `color` به هر style:
  - Realism → `#10b981` (emerald)
  - Urban → `#6366f1` (indigo)
  - Construction → `#f59e0b` (amber)
  - AI & Modern → `#06b6d4` (cyan)
  - Nature → `#22c55e` (green)
  - Advertising → `#ec4899` (pink)
  - Inspirational → `#f97316` (orange)

**2. آرایه PRODUCT_ICONS:**
- حذف `labelFa`
- اضافه کردن `shape` به هر محصول برای تفاوت ظاهری:
  - Fiberglass → `rounded-full`
  - Stirrups → `rounded-none` (مربع)
  - Cages → `rounded-lg`
  - Hooks → `rounded-full`
  - Dowels → `rounded-md`
  - Wire Mesh → `rounded-none`
  - Straight → `rounded-xl`

**3. رندر Style buttons (خطوط ~518-550):**
- هر دکمه با رنگ مخصوص خودش رندر شود (مشابه product buttons)
- وقتی active: پس‌زمینه رنگی + border رنگی + آیکون رنگی
- وقتی inactive: آیکون با رنگ ملایم‌تر همان رنگ
- Tooltip فقط انگلیسی

**4. رندر Product buttons (خطوط ~554-588):**
- هر دکمه shape متفاوت داشته باشد (از `shape` property)
- active/inactive styling مشابه فعلی ولی با shape اعمال‌شده
- Tooltip فقط انگلیسی

**5. اندازه آیکون‌ها:**
- Style icons: `w-4 h-4` → `w-5 h-5`
- Product icons: `w-5 h-5` → `w-6 h-6`
- padding دکمه‌ها: `p-1.5` → `p-2`

