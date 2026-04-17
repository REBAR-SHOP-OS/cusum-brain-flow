

## درخواست کاربر
1. بخش "Internal reference only" همیشه ترجمه فارسی **کپشن** و **متن داخل عکس** را نمایش دهد (الان "ترجمه‌ای موجود نیست" نشان می‌دهد چون auto-translate برای پست‌های قدیمی trigger نشده).
2. تأیید: این بخش هرگز publish نشود (در حال حاضر `stripPersian` در `usePublishPost.ts` این کار را می‌کند ✅).
3. یک آیکون اضافه شود تا بتوان زبان‌های دیگر (مثلاً اسپانیایی، فرانسوی، عربی) را هم در این بخش دید.

## یافته‌ی فنی
در `PostReviewPanel.tsx`:
- خط 291-337: auto-translate effect فقط وقتی trigger می‌شود که `localContent` تغییر کند یا `lastTranslatedCaptionRef` خالی باشد. برای پست‌هایی که از قبل ساخته شده‌اند و `---PERSIAN---` در DB ندارند، effect باید روی mount اجرا شود — ولی اگر در همان لحظه `lastTranslatedCaptionRef === caption` بشود (مثلاً بعد از retry)، skip می‌شود.
- شرط فعلی: `if (lastTranslatedCaptionRef.current === caption && (persianCaptionText || persianImageText)) return;` — این درست است، اگر ترجمه خالی باشد دوباره تلاش می‌کند.
- مشکل واقعی: برای پست‌های قدیمی که قبل از deploy فیکس قبلی translate-caption صدا زده نشده، effect روی `[post?.id, localContent, localTitle]` وابسته است. هنگام navigate به پست، `localContent` ست می‌شود ولی شاید edge function fail کرده و silently warn زده باشد (`console.warn("Auto-translate failed:", err);`).

علاوه بر این، edge function `translate-caption` فقط Persian تولید می‌کند — برای multi-language support باید یک پارامتر `targetLang` بپذیرد.

`usePublishPost.ts` خط 7-13: `stripPersian` کاملاً Persian block را قبل از publish حذف می‌کند. ✅ پس بند ۲ نیازی به تغییر ندارد.

## برنامه (Surgical, Additive)

### ۱. اضافه کردن آیکون انتخاب زبان
در `PostReviewPanel.tsx` خط 907-933 (همان box "Internal reference only"):
- یک `Popover` با آیکون `Languages` (از lucide-react) در گوشه‌ی بالا-راست box
- لیست زبان‌ها: فارسی (پیش‌فرض), اسپانیایی, فرانسوی, عربی, آلمانی
- state جدید: `displayLang: "fa" | "es" | "fr" | "ar" | "de"` (پیش‌فرض `fa`)
- state جدید: `translations: Record<string, { caption: string; imageText: string }>` برای cache کردن ترجمه‌های دیگر

### ۲. گسترش `translate-caption` edge function
- اضافه کردن پارامتر اختیاری `targetLang` (پیش‌فرض `fa`)
- prompt به‌صورت داینامیک نام زبان مقصد را بگیرد
- response keys ثابت بمانند: `{ captionFa, imageTextFa }` → نام‌گذاری generic: `{ captionTranslated, imageTextTranslated }` ولی برای backward-compat هر دو key را برگردانیم.

### ۳. تضمین trigger ترجمه برای همه‌ی پست‌ها
- در sync effect (خط 240-284): اگر post.content فاقد `---PERSIAN---` بود **و** `localContent` غیرخالی بود، `lastTranslatedCaptionRef.current` را reset کنیم تا effect ترجمه دوباره trigger شود.
- در صورت fail بودن edge function، یک retry button کوچک (آیکون `RefreshCw`) داخل box اضافه کنیم.

### ۴. ذخیره‌سازی ترجمه‌های زبان‌های اضافی
- ترجمه‌های غیر-Persian فقط در state کلاینت cache شوند (نه در DB)، چون فقط reference هستند و هزینه‌ی ذخیره ندارند. وقتی panel بسته/باز شد، یا کاربر روی آیکون زبان جدید کلیک کرد، یک fetch جدید انجام می‌شود.
- Persian همچنان در `---PERSIAN---` ذخیره می‌شود (تغییری در DB schema نیست).

### ۵. UX بخش "Internal reference"
```
┌──────────────────────────────────────────────┐
│ 🔒 Internal reference only — not published 🌐│  ← آیکون Languages
│ 🖼️ Image text:    ترجمه‌ی متن عکس           │
│ 📝 Caption:       ترجمه‌ی کپشن               │
└──────────────────────────────────────────────┘
```
- `dir` بسته به زبان انتخابی (`rtl` برای fa/ar، `ltr` برای بقیه) داینامیک شود.

### ۶. تضمین عدم publish (بدون تغییر — فقط verify)
- `usePublishPost.ts` `stripPersian` قبل از ارسال به social-publish فراخوانی می‌شود ✅
- `PixelChatRenderer.tsx` و `PixelPostCard.tsx` هم Persian block را separate render می‌کنند ✅
- نیازی به تغییر در publish path نیست.

## فایل‌های تغییرکننده
- `src/components/social/PostReviewPanel.tsx` — افزودن آیکون Languages، state چند-زبانه، popover، retry trigger
- `supabase/functions/translate-caption/index.ts` — پذیرش پارامتر `targetLang`، prompt داینامیک، response با key مناسب

## آنچه دست‌نخورده می‌ماند
- `usePublishPost.ts` (Persian strip از قبل OK)
- `social-publish` edge function
- DB schema / RLS / `social_posts` table
- `PixelPostCard.tsx` و `PixelChatRenderer.tsx`
- منطق auto-save و auto-translate برای Persian
- زبان UI: انگلیسی

## نتیجه‌ی مورد انتظار
1. ✅ بخش Internal Reference همیشه ترجمه را نشان می‌دهد (با retry برای پست‌های قدیمی)
2. ✅ کاربر با کلیک روی آیکون 🌐 می‌تواند زبان نمایش را تغییر دهد (fa/es/fr/ar/de)
3. ✅ ترجمه‌ها cache می‌شوند تا fetch مکرر نشود
4. ✅ این بخش تحت هیچ شرایطی publish نمی‌شود (verified)
5. ✅ زبان UI انگلیسی، محتوای ترجمه به زبان انتخابی

