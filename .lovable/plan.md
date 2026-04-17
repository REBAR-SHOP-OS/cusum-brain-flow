
## درک درخواست
کاربر می‌گوید وقتی در حال ساخت ویدیو است و از صفحه `/ad-director` خارج می‌شود، عملیات نباید متوقف شود — باید تا انتها (آماده شدن واقعی فیلم) ادامه پیدا کند.

## بررسی کد فعلی

### معماری موجود — تا حدی درست است
- `src/lib/backgroundAdDirectorService.ts` یک **singleton** است که خارج از React lifecycle زندگی می‌کند
- `AdDirectorContent.tsx` فقط با `service.subscribe()` به آن وصل می‌شود و در unmount فقط `unsubscribe()` می‌زند — **نه `cancel()`**
- پس از نظر منطق پایپلاین، تماس‌های edge function به `generate-video`، polling، analyze، prompt-writing **در پس‌زمینه ادامه می‌یابند**

### اما سه مشکل واقعی باعث توقف می‌شوند:

**۱. Phase 3 (Stitching) به DOM وابسته است**
در `videoStitch.ts` خطوط 461 و 647:
- از `MediaRecorder` استفاده می‌کند → وقتی tab/page hidden شود **شدیداً throttle می‌شود یا متوقف می‌شود**
- از `requestAnimationFrame` در حلقه‌ی draw استفاده می‌کند → در tab مخفی فریم‌ها به ۱ در ثانیه می‌افتند یا کاملاً pause می‌شوند
- وقتی کاربر از route خارج می‌شود، صفحه قابل‌مشاهده می‌ماند (route دیگر) ولی همان فریم‌ها همچنان در یک canvas جدا اجرا می‌شوند — این بخش معمولاً سالم می‌ماند مگر در tab switch واقعی

**۲. Toast notifications به‌عنوان فیدبک نهایی کافی نیستند**
سرویس فقط در صورت `!this.listener` (یعنی unmount) toast پایانی می‌فرستد. اما چون toast فقط در لحظه‌ی پایان دیده می‌شود و کاربر در صفحه‌ی دیگری است، **هیچ نشانه‌ای از پیشرفت** در حین کار در سایر صفحات ندارد. کاربر فکر می‌کند همه چیز متوقف شده.

**۳. هنگام بازگشت به route، state ریست نمی‌شود ولی نشانه‌ی واضحی هم نیست**
useEffect در mount `setPipelineState(service.getState())` صدا می‌زند که خوب است، **اما** اگر `service.isRunning()` نمایش داده نشود کاربر فکر می‌کند چیزی در جریان نیست.

## برنامه‌ی اصلاحی (Surgical, Additive)

### تغییر ۱ — یک Floating Progress Indicator سراسری اضافه کنیم
فایل جدید: `src/components/ad-director/AdDirectorBackgroundIndicator.tsx`
- در `App.tsx` (یا layout اصلی) همیشه mount می‌شود
- به `backgroundAdDirectorService` subscribe می‌کند
- وقتی `isRunning() === true` و route فعلی `/ad-director` نیست → یک **pill شناور** در گوشه نشان می‌دهد:
  - "🎬 Generating video... 45%"
  - دکمه‌ی "View" که به `/ad-director` برمی‌گرداند
- وقتی پایپلاین تمام شد و کاربر هنوز خارج از صفحه است → toast موفقیت + همان pill با CTA "View result"

این تأیید بصری به کاربر می‌دهد که **عملیات واقعاً در پس‌زمینه ادامه دارد** و انتخاب می‌کند هر وقت بخواهد برگردد.

### تغییر ۲ — جلوگیری از throttle شدن stitching در صفحات مخفی
در `src/lib/backgroundAdDirectorService.ts` در `handleExportInternal`:
- قبل از فراخوانی `stitchClips`، یک **Wake Lock** درخواست می‌کنیم (در صورت پشتیبانی مرورگر)
- علاوه بر آن، تشخیص می‌دهیم اگر document hidden است → یک log warning اما کار را ادامه می‌دهیم

**نکته مهم:** اگر کاربر کاملاً tab را مخفی کند، `MediaRecorder` در پس‌زمینه‌ی برخی مرورگرها throttle می‌شود. تنها راه قطعی، انتقال stitching به یک edge function سمت سرور است (که خارج از scope این تغییر سطحی است). برای جابجایی بین route‌های داخل همان tab — مشکلی نخواهد بود چون document همچنان visible است.

### تغییر ۳ — اطمینان از عدم cancel در unmount
بررسی `AdDirectorContent.tsx` خط 52: فقط `service.unsubscribe()` صدا می‌زند — **هیچ `service.cancel()` در cleanup وجود ندارد** ✓
این بخش از قبل درست است، فقط در صورت تأیید نهایی نگه داشته می‌شود.

### تغییر ۴ — وقتی کاربر برمی‌گردد، loader را با state واقعی نشان دهیم
در `AdDirectorContent.tsx` بعد از hydrate، اگر `flowState` در حالت `analyzing` یا `generating` است، اتوماتیک loader نمایش داده می‌شود (همین الآن کار می‌کند چون state از service خوانده می‌شود) — فقط اطمینان حاصل می‌کنیم که هیچ reset ناخواسته‌ای در mount وجود ندارد.

## آنچه تغییر **نمی‌کند**
- منطق `startPipeline`، analyze، generate-video، polling — بدون تغییر
- Edge functions (`ad-director-ai`, `generate-video`) — بدون تغییر
- DB schema و RLS — بدون تغییر
- صفحات دیگر و ad-director sidebar — بدون تغییر
- `videoStitch.ts` — بدون تغییر در منطق (فقط wake-lock اطراف فراخوانی)

## نتیجه
- وقتی کاربر در حال ساخت ویدیو از `/ad-director` خارج می‌شود:
  - پایپلاین کاملاً در پس‌زمینه ادامه می‌دهد (analyze → generate scenes → stitch)
  - یک **pill شناور سراسری** در سایر صفحات نشان می‌دهد: "🎬 Generating... X%" + دکمه‌ی "View"
  - وقتی تمام شد، toast موفقیت + لینک به نتیجه نمایش داده می‌شود
  - Wake Lock تلاش می‌کند مرورگر را از throttle شدن stitching باز دارد
- وقتی کاربر برمی‌گردد، loader با وضعیت دقیق فعلی نمایش داده می‌شود — هیچ کاری از سر گرفته نمی‌شود

### محدودیت صادقانه
اگر کاربر کاملاً tab مرورگر را ببندد یا کامپیوتر را خاموش کند، عملیات client-side متوقف خواهد شد (چون stitching و orchestration در browser اجرا می‌شوند). راه‌حل کامل (server-side rendering pipeline) یک پروژه‌ی بزرگ‌تر است که در صورت تمایل می‌توانیم به‌صورت جداگانه برنامه‌ریزی کنیم.
