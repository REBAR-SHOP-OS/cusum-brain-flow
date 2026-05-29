## هدف نهایی
مشکل پابلیش Instagram حل شود: ویدئویی که الان با پسوند `.mp4` ذخیره شده ولی واقعاً Instagram-ready نیست، قبل از پابلیش شناسایی/تبدیل شود و بعد تست شود.

## علت محتمل
- خطا از `social-publish` و helper `instagramPublish.ts` می‌آید.
- پست فعلی: `Precision Construction in Action` با `image_url` در bucket `social-media-assets/videos/...mp4` fail شده است.
- مسیر آپلود فعلی در `src/lib/socialMediaStorage.ts` برای هر ویدئو پسوند `.mp4` می‌گذارد، حتی اگر Blob واقعی `video/webm` باشد. یعنی WebM/MediaRecorder خروجی مرورگر با اسم `.mp4` ذخیره شده و Instagram آن را رد می‌کند.
- `videoStitch.ts`, `videoWatermark.ts`, `videoTrim.ts` هم با `MediaRecorder` خروجی WebM می‌سازند؛ پس باید جلوی ذخیره/پابلیش اشتباه گرفته شود، نه اینکه guard اینستاگرام حذف شود.

## پلن اجرا
1. **اصلاح ذخیره ویدئو در فرانت‌اند**
   - در `src/lib/socialMediaStorage.ts` پسوند و `contentType` را از Blob واقعی تعیین می‌کنم.
   - اگر خروجی WebM باشد، دیگر با پسوند `.mp4` ذخیره نمی‌شود.
   - برای آپلود دستی Instagram فقط فایل واقعی `video/mp4` قبول شود و WebM/MOV با پیام واضح رد شود.

2. **افزودن مسیر تبدیل امن برای پست fail شده**
   - یک backend function کوچک برای آماده‌سازی ویدئوی Instagram اضافه/اصلاح می‌کنم که ویدئوی موجود را دانلود کند، با FFmpeg به MP4 واقعی H.264 + AAC تبدیل کند، در `social-media-assets/videos/...-instagram-ready.mp4` آپلود کند و URL جدید برگرداند.
   - اگر محیط FFmpeg backend آماده نبود، function خطای واضح بدهد تا به جای پابلیش ناموفق، UI کاربر را راهنمایی کند.

3. **اتصال تبدیل به جریان Publish**
   - قبل از ارسال Instagram Reel/Post ویدئویی، اگر asset مشکوک باشد یا guard بگوید Instagram-ready نیست، به جای fail فوری، مسیر آماده‌سازی اجرا شود و پست با URL جدید retry شود.
   - guard امنیتی Instagram حذف نمی‌شود؛ فقط به جای بن‌بست، یک repair path اضافه می‌شود.

4. **اصلاح پست فعلی در دیتابیس**
   - ویدئوی fail شده برای `Precision Construction in Action` را تبدیل می‌کنم.
   - `image_url` همان پست را به نسخه `-instagram-ready.mp4` تغییر می‌دهم و `last_error` را پاک می‌کنم تا آماده retry باشد.

5. **تست و اعتبارسنجی**
   - با `ffprobe`/metadata مسیر تبدیل را تست می‌کنم: container=`mp4`, video codec=`h264`, audio codec=`aac` یا audio track سازگار.
   - regression test موجود `instagram-video-spec.test.ts` را گسترش می‌دهم تا WebM با پسوند fake `.mp4` دیگر قابل ذخیره/پابلیش بدون آماده‌سازی نباشد.
   - function `social-publish` را deploy و با curl edge function تست می‌کنم تا خطای قبلی دیگر تکرار نشود.

## ریسک‌ها و محدودیت‌ها
- اگر خود ویدئو corrupt باشد، تبدیل هم fail می‌شود و باید ویدئو دوباره regenerate شود.
- اگر Instagram بعد از تبدیل به خاطر token/page permission خطا بدهد، آن یک مشکل جدا از فرمت ویدئو است.
- قوانین Neel approval و قفل publish دست‌نخورده می‌مانند.