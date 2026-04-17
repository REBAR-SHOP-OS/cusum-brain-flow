
## درخواست کاربر
کاربر یک فایل ویدیویی آپلود کرده (`Series_of_pictures_202604170946.mp4`) و می‌خواهد این ویدیو در پس‌زمینه‌ی صفحه‌ی loading/progress (که در screenshot دیده می‌شود — همان جایی که "Re-generating 2 missing scenes of 2..." نمایش داده می‌شود) به صورت **بدون صدا** و loop پخش شود.

## بررسی لازم
1. پیدا کردن کامپوننتی که این صفحه‌ی progress/loading را render می‌کند (احتمالاً در `AdDirectorContent.tsx` یا یک کامپوننت progress جداگانه با Wand icon و progress bar)
2. تأیید جای دقیق layer پس‌زمینه

## برنامه (Surgical, Additive)

### گام ۱ — کپی فایل ویدیو
```
lov-copy user-uploads://Series_of_pictures_202604170946.mp4 public/videos/ad-director-loading-bg.mp4
```

### گام ۲ — پیدا کردن صفحه‌ی loading
بررسی `src/components/ad-director/AdDirectorContent.tsx` و فایل‌های مرتبط (مثلاً `GenerationProgress.tsx` یا state `flowState === "generating"`) برای یافتن دقیق محل render UI پیشرفت.

### گام ۳ — افزودن ویدیو پس‌زمینه
در همان wrapper صفحه‌ی loading، یک تگ `<video>` به‌عنوان absolute background اضافه می‌شود:

```tsx
<video
  src="/videos/ad-director-loading-bg.mp4"
  autoPlay
  loop
  muted
  playsInline
  className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none -z-10"
/>
```

ویژگی‌ها:
- `muted` + `playsInline` → autoplay در همه‌ی browserها بدون صدا
- `loop` → پخش مداوم تا پایان generation
- `opacity-30` تا متن progress و wand icon خوانا باقی بمانند (قابل تنظیم بر اساس preview)
- یک overlay مشکی نیمه‌شفاف اضافه می‌شود اگر contrast کافی نباشد

### آنچه تغییر نمی‌کند
- منطق generation و progress — بدون تغییر
- پیام‌ها، Wand icon، progress bar — بدون تغییر
- صفحه‌ی intro (`ad-director-intro.mp4`) — بدون تغییر
- سایر صفحات (Result، Editor) — بدون تغییر

### نتیجه
در مدت زمانی که scenes در حال generation هستند، ویدیوی آپلودشده به‌صورت silent، loop، و full-cover در پس‌زمینه پخش می‌شود و UI پیشرفت روی آن قرار می‌گیرد.
