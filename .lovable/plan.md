
## درخواست
کاربر می‌خواهد فضای خالی بالای کارت references در Ad Director (دایره‌ی قرمز در screenshot) به **لوگوی شرکت** اختصاص داده شود. فایل `LOGO.png` آپلود شده.

## برنامه (Surgical, Additive)

### ۱. کپی لوگو
```
lov-copy user-uploads://LOGO.png src/assets/company-logo.png
```
(در `src/assets` تا توسط Vite بهینه‌سازی و bundle شود.)

### ۲. افزودن لوگو در بالای `ChatPromptBar.tsx`
دقیقاً قبل از `<div className="grid gap-3 md:grid-cols-3">` (خط 368)، یک header کوچک و تمیز اضافه می‌شود:

```tsx
import companyLogo from "@/assets/company-logo.png";

<div className="flex justify-center pb-2">
  <img
    src={companyLogo}
    alt="Company logo"
    className="h-16 w-16 md:h-20 md:w-20 object-contain drop-shadow-[0_0_20px_rgba(234,179,8,0.25)]"
  />
</div>
```

ویژگی‌ها:
- وسط‌چین، اندازه‌ی متناسب (64-80px) — همان نقطه‌ی دایره‌ی قرمز
- `object-contain` تا نسبت تصویر حفظ شود
- یک `drop-shadow` ملایم طلایی که با رنگ سکه‌ی لوگو هماهنگ است (اختیاری ولی تمیز)
- responsive: کوچک‌تر در موبایل، بزرگ‌تر در desktop

### آنچه تغییر نمی‌کند
- کارت‌های Intro/Character/Outro — بدون تغییر
- نوار prompt و دکمه‌های Style/Products/AI Prompt/Character/Create — بدون تغییر
- صفحه‌های دیگر (loading, result, editor) — بدون تغییر
- منطق generation — بدون تغییر

### نتیجه
لوگوی شرکت دقیقاً در همان نقطه‌ای که کاربر در screenshot دایره کشیده، بالای کارت references نمایش داده می‌شود.
