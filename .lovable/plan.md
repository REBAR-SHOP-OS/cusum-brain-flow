

# اتصال عینک Ray-Ban Meta به Vizzy — راهنمای کامل

## وضعیت فعلی
- Edge function `vizzy-photo-analyze` آماده است و عکس‌ها را با Gemini Vision آنالیز می‌کند
- `VizzyPhotoButton` برای آپلود دستی عکس کار می‌کند
- عینک Ray-Ban Meta API مستقیم ندارد — باید از طریق **Meta View App** روی گوشی bridge بزنیم

## معماری اتصال

```text
Ray-Ban Meta Glasses
    │ (auto-sync photos)
    ▼
Meta View App (iPhone/Android)
    │ (saves to Camera Roll / "Meta View" album)
    ▼
iOS Shortcut / Capacitor App
    │ (monitors album, auto-uploads)
    ▼
vizzy-glasses-webhook (Edge Function - public, no JWT)
    │ (receives image, calls Gemini Vision)
    ▼
glasses_captures table + Push notification to Vizzy
```

## پلن پیاده‌سازی

### ۱. ساخت Edge Function: `vizzy-glasses-webhook`
- Endpoint عمومی (بدون JWT) با API key اختصاصی برای امنیت
- عکس را به صورت base64 یا URL دریافت می‌کند
- با Gemini 2.5 Flash آنالیز می‌کند (همان منطق vizzy-photo-analyze)
- نتیجه را در جدول `glasses_captures` ذخیره می‌کند

### ۲. ساخت جدول `glasses_captures`
- `id`, `image_url`, `analysis`, `source` (glasses/manual), `created_at`
- بدون user_id (webhook عمومی است، با API key محافظت می‌شود)

### ۳. ساخت Secret: `GLASSES_WEBHOOK_KEY`
- یک کلید رندوم برای احراز هویت webhook

### ۴. اضافه کردن بخش Glasses Captures به UI Vizzy
- نمایش آخرین عکس‌ها و آنالیزهای دریافتی از عینک

## قدم‌های شما (خارج از Lovable)

### قدم ۱: تنظیم Meta View App
1. اپ **Meta View** را از App Store/Play Store نصب کنید
2. عینک Ray-Ban Meta را pair کنید
3. در Settings → Auto-sync photos را روشن کنید
4. مطمئن شوید عکس‌ها به Camera Roll سینک می‌شوند

### قدم ۲: ساخت iOS Shortcut (ساده‌ترین روش)
بعد از پیاده‌سازی webhook، یک Shortcut بسازید که:
1. آخرین عکس از آلبوم "Meta View" را بگیرد
2. آن را POST کند به webhook URL
3. این Shortcut را با **Automation** تریگر کنید (هر وقت عکس جدید اضافه شد)

### قدم ۳: (اختیاری) Capacitor App
اگر بخواهید اپ اختصاصی بسازید که خودکار عکس‌ها را مانیتور کند، Capacitor setup می‌کنیم.

## پرامپت برای ساخت iOS Shortcut (کپی کنید در ChatGPT/Claude)

بعد از پیاده‌سازی webhook، این prompt را استفاده کنید:

> "Build me an iOS Shortcut that: 1) Gets the latest photo from the 'Meta View' album in Photos. 2) Converts it to base64. 3) Sends a POST request to URL: https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/vizzy-glasses-webhook with headers: Content-Type: application/json, x-webhook-key: [YOUR_KEY]. Body: {"imageBase64": [base64_data]}. 4) Shows the response 'analysis' field as a notification. Then create an Automation that runs this Shortcut every time a new photo is added to the Meta View album."

---

**خلاصه**: ابتدا webhook و جدول را می‌سازم، بعد شما Meta View App و iOS Shortcut را تنظیم می‌کنید. آیا شروع کنم؟

