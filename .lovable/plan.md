

## ریشه مشکل (Root Cause Analysis)

با بررسی کد و دیتابیس، **چند مشکل ریشه‌ای** پیدا شد که باعث می‌شوند یک scene fail شود در حالی که scene‌های دیگر OK هستند:

### مشکل ۱ — Hard-coded duration `15s` در پایپلاین
در `backgroundAdDirectorService.ts` خط 487:
```ts
const sceneDuration = 15;
```
بدون توجه به duration انتخابی کاربر یا تعداد scenes، **همه scenes با 15 ثانیه** به Wan API ارسال می‌شوند. اگر کاربر 15s + 2 scenes انتخاب کند، هر scene 15s درخواست می‌شود (مجموع 30s)، نه 7.5s مورد انتظار. این باعث:
- محتوای تولیدشده با timing intended هماهنگ نیست
- DashScope گاهی برای prompts تکراری در duration max به‌طور موقت محدودیت می‌گذارد

### مشکل ۲ — DB never updated as scenes complete
`saveProject` فقط **یکبار** در زمان analyze صدا زده می‌شود (خط 463) با `clips: initialClips` که همه `idle` هستند. هیچ‌وقت بعد از تکمیل scenes آپدیت نمی‌شود مگر کاربر روی "Save Draft" کلیک کند. دلیل اینکه DB هنوز `status:idle` نشان می‌دهد ولی UI failed دارد — state در حافظه و state در DB جدا شده‌اند. روی reload، recovery kicks in (که همان "Recovering missing scenes" قبلی بود).

### مشکل ۳ — اولین scene در معرض fail بیشتر است
خط 516-517:
```ts
if (isFirstScene && introImageUrl) referenceImage = introImageUrl;
```
اگر `introImageUrl` ست شده باشد، scene 1 با مدل `wan2.6-i2v` (image-to-video) فراخوانی می‌شود در حالی که scene 2 با `wan2.6-t2v` (text-to-video). I2V حساس‌تر به کیفیت رفرنس image است و اگر URL ناقص/expired/format-incompatible باشد، **فقط scene 1 fail می‌شود**.

### مشکل ۴ — End card مخفیانه به جای video
خط 503-505: اگر scene نوع `static-card` یا `closing` داشته باشد، به جای generate-video، یک canvas با لوگو drawing می‌شود (`generateEndCard`). در screenshot شما "Solution" به نظر می‌رسد از این مسیر آمده (تصویر زرد لوگو، نه video واقعی). یعنی فقط 1 scene واقعاً generate شده، و آن یکی fail شده.

### مشکل ۵ — خطای واقعی API hidden
خط 302 از `wanPoll`:
```ts
return { status: "failed", error: output.message || "Wan generation failed" };
```
وقتی DashScope به دلیل content moderation یا I2V image error رد می‌کند، error message اصلی API در logs ذخیره می‌شود ولی پیام generic ("Generation failed") به UI می‌رسد. کاربر نمی‌تواند بفهمد چرا fail شد.

---

## راه‌حل ریشه‌ای (Surgical, 3 files)

### Fix A — `src/lib/backgroundAdDirectorService.ts`
1. **خط 487**: حذف hardcoded `15` و محاسبه واقعی per-scene:
   ```ts
   const sceneDuration = Math.max(2, Math.min(15, Math.round(videoParams.duration / storyboardWithDefaults.length)));
   ```
2. **بعد از parallel generation**: یک `saveProject` مجدد با clips نهایی (پس از Promise.allSettled و retry rounds) اضافه شود تا DB با state واقعی sync شود (دیگر "recovery" روی reload اتفاق نیفتد).
3. **خطاهای واقعی را propagate کن**: در try/catch خطوط 557-558 و 654-656، خطای کامل API را در `error` field کلیپ ذخیره کن (نه فقط generic message).

### Fix B — `src/components/ad-director/AdDirectorContent.tsx`
در `handleRegenerateScene` (خط 354-358)، خطای کامل را در toast نمایش بده تا کاربر بفهمد چرا fail شد (مثلاً "Image too small" vs "Content blocked").

### Fix C — `supabase/functions/generate-video/index.ts`
در `wanPoll` (خط 293-307)، علاوه بر `output.message`، فیلدهای `output.code`، `output.task_metrics`، و `data.message` را هم استخراج کن. Wan معمولاً علت رد را در `code` می‌گذارد (مثلاً `DataInspectionFailed` برای moderation، `InvalidParameter.ImageURL` برای I2V image errors).

### What Stays the Same
- معماری Wan integration و provider routing — بدون تغییر
- UI scene cards و recovery flow قبلی — بدون تغییر
- Auto-save برای پروژه‌های اولیه — بدون تغییر، فقط یک save اضافی end-of-pipeline

### نتیجه
- Duration واقعی در هر scene اعمال می‌شود → fail rate کمتر
- DB همیشه state واقعی را بازتاب می‌دهد → دیگر "Recovering missing scenes" روی reload نمی‌بینید
- خطای واقعی scene fail در UI قابل مشاهده است (مثلاً "Image moderation rejected" vs generic "failed") → کاربر می‌تواند تصمیم درست بگیرد (تغییر prompt یا حذف intro image)
- اگر scene 1 به دلیل I2V fail شد، خطا واضح است: "I2V failed because intro image URL invalid"

