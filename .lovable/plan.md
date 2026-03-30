
هدف نهایی: هیچ‌وقت در حالت Result کارت بدون ویدئو نمایش داده نشود (نه idle، نه blank).  
تشخیص دقیق از کد فعلی:
- ریشه اصلی مشکل فقط retry نیست؛ پروژه‌های `analyzed` با `clips` از نوع `idle` در History قابل انتخاب هستند و مستقیم به `flowState: "result"` می‌روند، بنابراین کارت‌ها بدون ویدئو دیده می‌شوند.
- در `backgroundAdDirectorService` بعد از retry هنوز ممکن است کلیپ unresolved بماند، اما سیستم باز هم به مرحله export/result می‌رود.
- fallback اسلایدشو از `generate-video` (mode=slideshow) به‌صورت image URL برمی‌گردد، ولی مسیر Ad Director آن را به ویدئوی واقعی تبدیل نمی‌کند.

برنامه اصلاح (حداقلی ولی قطعی):

1) جلوگیری از ورود Draft ناقص به Result  
- فایل: `src/components/ad-director/VideoHistory.tsx`
- تغییر فیلتر نمایش Draft:
  - Draft فقط وقتی قابل نمایش/انتخاب باشد که حداقل یک clip با `status === "completed"` و `videoUrl` معتبر داشته باشد.
  - پروژه‌های صرفاً `idle/analyzed` دیگر مثل خروجی آماده نمایش داده نشوند.

2) بازیابی خودکار صحنه‌های ناقص هنگام انتخاب Draft  
- فایل: `src/components/ad-director/AdDirectorContent.tsx`
- در `onSelectDraft`:
  - قبل از `flowState: "result"` بررسی شود آیا برای همه storyboard sceneها clip completed با URL داریم یا نه.
  - اگر نداریم:
    - `flowState` به `generating` برود
    - فرآیند regenerate برای صحنه‌های missing/idle/failed اجرا شود
    - فقط بعد از تکمیل همه، به `result` برگردد.

3) سخت‌گیری نهایی در Pipeline: عبور ممنوع با کلیپ ناقص  
- فایل: `src/lib/backgroundAdDirectorService.ts`
- یک helper مشترک برای تولید هر scene بسازیم (برای initial + retry).
- Retry فقط روی `failed` نباشد؛ روی همه unresolvedها اعمال شود:
  - `idle | queued | generating(without videoUrl) | failed`
- قبل از export شرط اجباری:
  - اگر حتی یک scene بدون videoUrl completed باقی ماند، export/result متوقف شود و flow در generating/editing بماند با پیام واضح.
- نتیجه: دیگر Result با کارت خالی ساخته نمی‌شود.

4) هندل fallback اسلایدشو به‌صورت ویدئو واقعی  
- فایل: `src/lib/backgroundAdDirectorService.ts`
- اگر پاسخ `generate-video` شامل `mode: "slideshow"` و `imageUrls` بود:
  - با `slideshowToVideo` به blob video تبدیل شود
  - همان blob URL به clip.videoUrl ثبت شود (status=completed)
- این باعث می‌شود fallback هم همیشه کارت ویدئویی داشته باشد.

5) بهبود UX برای کارت ناقص (ضد blank)  
- فایل: `src/components/ad-director/AdDirectorContent.tsx`
- در گالری Result:
  - اگر clip unresolved بود، به‌جای state خنثی (film icon) پیام actionable + retry نشان داده شود.
  - گزینه “Retry missing scenes” یکجا اضافه شود.

اعتبارسنجی بعد از اعمال:
- سناریو 1: تولید جدید 2/4 صحنه → حتی با خطای provider، هیچ کارت idle در Result نباشد.
- سناریو 2: انتخاب Draft قدیمی analyzed → ابتدا recovery اجرا شود، سپس Result نمایش داده شود.
- سناریو 3: fallback slideshow → کارت‌ها playable video داشته باشند.
- سناریو 4: شرط نهایی: در `flowState: "result"` برای هر scene باید clip completed + videoUrl وجود داشته باشد.
