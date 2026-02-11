

## افزودن آیکون Brain به ایجنت Pixel برای مدیریت دانش اختصاصی

### خلاصه
یک آیکون مغز (Brain) در هدر چت ایجنت Pixel اضافه می‌شود که با کلیک روی آن، دیالوگ AddKnowledgeDialog باز شده و کاربر می‌تواند منابع، دستورعمل‌ها و محتوای آموزشی مخصوص تولید محتوای شبکه‌های اجتماعی را اضافه کند. همچنین امکان مشاهده دانش‌های ذخیره‌شده قبلی وجود خواهد داشت.

### تغییرات

**فایل: `src/pages/AgentWorkspace.tsx`**
- اضافه کردن آیکون Brain در نوار بالای چت (کنار toggle سایدبار)، فقط برای ایجنت `social`
- با کلیک روی آن، یک دیالوگ Brain باز می‌شود که شامل:
  - لیست دانش‌های موجود (فیلتر شده با metadata.agent = "social")
  - دکمه افزودن دانش جدید (با استفاده از همان AddKnowledgeDialog موجود)
- state جدید: `brainOpen` برای کنترل باز/بسته شدن دیالوگ
- import کردن `Brain` از lucide-react و `AddKnowledgeDialog` و `KnowledgeDetailDialog`

**فایل جدید: `src/components/social/PixelBrainDialog.tsx`**
- یک دیالوگ (Sheet یا Dialog) که دانش‌های مرتبط با ایجنت social را نمایش می‌دهد
- فیلتر خودکار: فقط آیتم‌هایی که `metadata.agent = "social"` دارند نشان داده می‌شوند
- دکمه "Add Knowledge" برای باز کردن AddKnowledgeDialog با metadata پیش‌فرض `{ agent: "social" }`
- امکان کلیک روی هر آیتم برای مشاهده جزئیات (KnowledgeDetailDialog)
- ظاهر ساده و تمیز، مطابق با سبک فعلی اپ

**فایل: `src/components/brain/AddKnowledgeDialog.tsx`**
- اضافه کردن prop اختیاری `defaultMetadata` برای ارسال metadata پیش‌فرض (مثلا `{ agent: "social" }`)
- هنگام ذخیره، این metadata با metadata موجود merge می‌شود

### چه چیزی تغییر نمی‌کند
- صفحه Brain اصلی
- عملکرد سایر ایجنت‌ها
- ظاهر کلی اپلیکیشن
- جدول knowledge در دیتابیس (بدون تغییر schema -- از فیلد metadata موجود استفاده می‌شود)

### جزئیات فنی
- جدول `knowledge` دارای ستون `metadata` از نوع JSONB است که می‌توان `agent: "social"` را در آن ذخیره کرد
- فیلتر کردن در سمت کلاینت از روی metadata انجام می‌شود
- نیازی به migration نیست

