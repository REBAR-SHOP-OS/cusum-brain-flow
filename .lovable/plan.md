
# تغییر نام برند از CUSUM به REBAR SHOP OS

## خلاصه
تغییر نام برند در تمام فایل‌های پروژه بدون هیچ تغییری در کارکرد یا ظاهر اپلیکیشن.

---

## فایل‌های نیازمند تغییر

### 1. فایل‌های Frontend (صفحات)

| فایل | تغییرات |
|------|---------|
| `src/pages/Landing.tsx` | تغییر "CUSUM" به "REBAR SHOP OS" در header، hero section و footer |
| `src/pages/Login.tsx` | تغییر عنوان صفحه ورود |
| `src/pages/Signup.tsx` | تغییر متن "Get started with CUSUM" |
| `src/pages/Home.tsx` | تغییر "How can CUSUM help you today?" |
| `src/pages/Settings.tsx` | تغییر "CUSUM Pro" به "REBAR SHOP OS Pro" |
| `src/pages/Install.tsx` | تغییر نام اپ در صفحه نصب PWA |

### 2. فایل‌های پیکربندی

| فایل | تغییرات |
|------|---------|
| `index.html` | تغییر title، meta tags، Open Graph و Twitter Card |
| `vite.config.ts` | تغییر manifest PWA (name و short_name) |

### 3. فایل‌های Backend (Edge Functions)

| فایل | تغییرات |
|------|---------|
| `supabase/functions/ai-agent/index.ts` | تغییر system prompts تمام agent‌ها (sales, accounting, support, collections, estimation) |

### 4. فایل‌های استایل

| فایل | تغییرات |
|------|---------|
| `src/index.css` | تغییر کامنت "Custom CUSUM tokens" |

---

## جزئیات فنی

### تغییرات در `index.html`:
```text
- title: "CUSUM - AI Operations Management" → "REBAR SHOP OS - AI Operations Management"
- meta author: "CUSUM" → "REBAR SHOP OS"
- apple-mobile-web-app-title: "CUSUM" → "REBAR SHOP OS"
- og:title و twitter:title به همین ترتیب
```

### تغییرات در `vite.config.ts`:
```text
- name: "CUSUM - AI Operations Management" → "REBAR SHOP OS"
- short_name: "CUSUM" → "REBAR SHOP OS"
```

### تغییرات در AI Agent Prompts:
هر ۵ agent باید به‌روزرسانی شوند:
- "Sales Agent for CUSUM" → "Sales Agent for REBAR SHOP OS"
- "Accounting Agent for CUSUM" → "Accounting Agent for REBAR SHOP OS"
- و همینطور برای support، collections، estimation

---

## نکات مهم
- هیچ تغییری در کارکرد، رنگ‌ها، یا چیدمان UI اعمال نمی‌شود
- فقط متن‌ها و نام برند عوض می‌شود
- لینک‌های Privacy Policy و Terms of Service همچنان به URL فعلی اشاره می‌کنند (این نیاز به تغییر در تنظیمات دامنه دارد که خارج از scope این کار است)

---

## تعداد فایل‌ها
**۸ فایل** نیاز به ویرایش دارند
