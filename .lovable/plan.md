

# تبدیل دکمه‌های Regenerate و Download به آیکون + بهبود عملکرد Regenerate

## تغییرات

### 1. آیکون‌سازی دکمه‌ها (`src/components/chat/RichMarkdown.tsx`)
در بخش `img` renderer (خطوط 195-216)، متن‌های "Download" و "Regenerate" حذف شده و فقط آیکون‌ها باقی می‌مانند:

- **Download**: آیکون `Download` از lucide به جای متن `⬇️ Download`
- **Regenerate**: آیکون `RefreshCw` بدون متن "Regenerate"
- هر دو به صورت دکمه‌های گرد کوچک با tooltip نمایش داده می‌شوند

### 2. عملکرد Regenerate تصادفی (`src/pages/AgentWorkspace.tsx`)
در تابع `handleRegenerateImage` (خط 319-322)، به جای ارسال نام محصول قبلی، پیام به صورت زیر تغییر می‌کند:

```
"Regenerate this slot with a random product"
```

### 3. پشتیبانی بک‌اند (`supabase/functions/ai-agent/index.ts`)
در بخش پردازش پیام‌های Pixel، الگوی "regenerate" شناسایی شده و:
- یک محصول تصادفی از جدول knowledge انتخاب می‌شود
- همان اسلات فعلی دوباره تولید می‌شود (تصویر + کپشن جدید)

---

### جزئیات فنی

**RichMarkdown.tsx** — تغییر ظاهر دکمه‌ها:
- `Download` import از lucide اضافه می‌شود
- لینک دانلود: فقط آیکون `Download` با `title="Download"`
- دکمه regenerate: فقط آیکون `RefreshCw` با `title="Regenerate"`
- هر دو در قالب دکمه‌های `w-7 h-7` گرد

**AgentWorkspace.tsx** — تغییر پیام regenerate:
- پیام ارسالی به `"regenerate random"` تغییر می‌کند تا بک‌اند بداند باید محصول تصادفی انتخاب کند

**ai-agent/index.ts** — شناسایی الگوی regenerate:
- الگوی `/regenerate\s*(random|this slot)/i` اضافه می‌شود
- وقتی شناسایی شد، از بین محصولات knowledge یکی به صورت تصادفی انتخاب و پست جدید ساخته می‌شود
