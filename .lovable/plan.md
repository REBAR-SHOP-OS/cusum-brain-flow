## از کجا آمده (Root cause)

پیام داخل کادر زرد دقیقاً از این خط در `supabase/functions/_shared/instagramPublish.ts` می‌آید:

```ts
const INSTAGRAM_VIDEO_SPEC_ERROR =
  "Instagram Reels require a real MP4 video encoded as H.264 with AAC audio. This file is not Instagram-ready; re-render/export it as MP4 before publishing to Instagram.";
```

این پیام در دو نقطه برمی‌گردد:

1. **Pre-flight** (`isClearlyUnsupportedInstagramVideo`) — فقط webm / mov / wmv / mkv / avi را بلوک می‌کند. هرچیزی که `.mp4` یا `video/mp4` باشد بدون بررسی codec رد می‌شود.
2. **Container status = ERROR** (خط ۳۱۶–۳۲۱) — وقتی container ساخته می‌شود، آپلود می‌رود به اینستاگرام، و Instagram در فاز پردازش status را `ERROR` می‌کند، همین متن + جمله `Instagram rejected this upload during processing.` به کاربر نشان داده می‌شود. این دقیقاً همان چیزی است که در اسکرین‌شات می‌بینید (هفت بار برای هفت Page).

پس کدِ ما درست رفتار کرده — **علت واقعی این است که فایل ویدیویی که به‌عنوان `video_url` به Graph API می‌فرستیم، یک MP4 با codec قابل قبول Reels نیست** (به احتمال زیاد VP9/AV1 در ظرف mp4، یا HEVC، یا بدون track صدای AAC، یا fps/ابعاد غیرمجاز — مثلاً ویدیوهای تولید‌شده توسط Wan/Veo که داخل ظرف mp4 ولی با codec غیر-H.264 خروجی می‌دهند). pre-flight فعلی این موارد را تشخیص نمی‌دهد چون فقط به پسوند و mime نگاه می‌کند.

## راه‌حل ریشه‌ای و امن

ایده: قبل از ارسال `video_url` به Instagram، فایل را به‌صورت قطعی به MP4 سازگار با Reels تبدیل کنیم (H.264 high@4.1 + AAC-LC 128k، yuv420p، 30fps، 1080×1920 یا 1080×1350)، نتیجه را در Storage بریزیم، و آن URL را برای IG استفاده کنیم. اگر Probe قطعی بگوید فایل از پیش سازگار است، transcode را skip می‌کنیم.

### پیاده‌سازی

1. **Edge: `_shared/videoProbe.ts` (جدید)**
   - با `Range: bytes=0-262143` ۲۵۶KB اول فایل را می‌گیرد.
   - با parser سبک `ftyp` + `moov`/`trak`/`stsd` codec ویدیو (`avc1` vs `hev1`/`hvc1`/`vp09`/`av01`) و codec صدا (`mp4a`) را تشخیص می‌دهد.
   - برمی‌گرداند: `{ container, videoCodec, audioCodec, isInstagramReady }`.
   - اگر probe fail شد → `isInstagramReady: false` (محافظه‌کارانه).

2. **Edge: `prepare-instagram-video` (جدید)**
   - ورودی: `sourceUrl`، `aspectHint` (`reel` | `story` | `feed`).
   - مرحله ۱: probe می‌کند. اگر آماده است، همان URL را برمی‌گرداند با `transcoded: false`.
   - مرحله ۲: cache lookup بر اساس `sha256(sourceUrl + spec)` در جدول `instagram_video_renders` (id, source_url, spec, output_url, status). اگر `ready` بود همان را برگردان.
   - مرحله ۳: GCE pipeline (همان `gce-video-assembly` که از قبل ffmpeg دارد) را در حالت "transcode-only" صدا می‌زند با command استاندارد Reels:
     ```
     -c:v libx264 -profile:v high -level 4.1 -pix_fmt yuv420p -preset veryfast -crf 23
     -c:a aac -b:a 128k -ar 44100 -ac 2
     -r 30 -movflags +faststart -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"
     ```
   - خروجی روی bucket `social-media-renders` با naming `ig-ready/{hash}.mp4` ذخیره می‌شود و URL عمومی برمی‌گردد.
   - اگر GCE credential نباشد → خطای واضح `IG_TRANSCODE_UNAVAILABLE` (نه fallback مرورگری، چون cron هم از این مسیر می‌آید).

3. **اتصال در `social-publish/index.ts`**
   - قبل از فراخوانی `publishInstagramMedia` برای `instagram`، اگر media ویدیویی است:
     - `prepare-instagram-video` فراخوانی شود.
     - `imageUrl` با `output_url` جایگزین شود.
     - اگر transcode fail کرد، status post به `failed` با reason `ig_not_ready` و پیام خوانا برای کاربر.
   - این مسیر هم برای Retry Publishing دستی و هم cron-publish فعال است.

4. **`instagramPublish.ts` تقویت‌شده**
   - `isClearlyUnsupportedInstagramVideo` گسترش پیدا کند با خروجی `videoProbe` (codec غیر-avc1 هم بلوک شود).
   - بدین ترتیب حتی اگر کسی مستقیماً URL بد بدهد، قبل از ساخت container بلوک می‌شود.

5. **UI**
   - در `PostReviewPanel`/پنل اسکرین‌شات، قبل از "Retry Publishing" یک badge کوچک: «Preparing Instagram-ready video…» وقتی `prepare-instagram-video` در حال اجراست (از `instagram_video_renders.status`).
   - متن خطا با عمل دکمه عوض می‌شود: اگر علت `ig_not_ready` بود، دکمه می‌شود «Re-prepare & retry» که عمداً cache را invalidate می‌کند.

6. **DB migration**
   - جدول `instagram_video_renders` با ستون‌های `source_hash unique, source_url, spec, status, output_url, error, company_id, created_at`.
   - RLS با `is_company_member(company_id)`، GRANT استاندارد، service_role full.

7. **Regression tests** (افزودن به `tests/regression/social/`):
   - `instagram-video-probe.test.ts`: ftyp/moov sample های avc1/hev1/vp09 درست شناسایی شوند.
   - `instagram-publish-uses-prepared-url.test.ts`: snapshot از `social-publish` که اگر media ویدیو است، `prepare-instagram-video` صدا زده شده و `video_url` ارسالی همان output است.
   - `instagram-cron-respects-transcode-failure.test.ts`: اگر prepare fail کرد، cron نباید container بسازد.

### چرا «امن» است

- هیچ مسیر فعلی حذف یا rename نمی‌شود (طبق Surgical Execution).
- pre-flight موجود قوی‌تر می‌شود، نه ضعیف‌تر.
- transcode فقط برای ویدیوهای ناسازگار اجرا می‌شود (cache + probe skip).
- خطای روشن به جای پیام عمومی به کاربر می‌رسد، Neel-only approval gate دست‌نخورده باقی می‌ماند.
- silent-video rule حفظ می‌شود: ffmpeg با `-c:a aac` فقط روی track صدای موجود اعمال می‌شود؛ اگر منبع silent باشد، یک silent AAC track افزوده می‌شود تا IG قبول کند، بدون افزودن محتوای صوتی.

### Verification بعد از build

- `vitest run tests/regression/social` 
- یک ویدیوی Wan تستی publish روی یک IG Page تست → status باید `published` شود.
- لاگ `social-publish` نشان دهد `prepare-instagram-video` قبل از `publishInstagramMedia` صدا خورده.
