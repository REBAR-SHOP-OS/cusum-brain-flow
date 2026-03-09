
# اتصال عینک Ray-Ban Meta به Vizzy — وضعیت پیاده‌سازی

## ✅ انجام شده
1. **جدول `glasses_captures`** — ساخته شد با RLS
2. **Edge Function `vizzy-glasses-webhook`** — آماده و deploy شد
3. **`GLASSES_WEBHOOK_KEY`** — Secret تنظیم شد
4. **`config.toml`** — verify_jwt=false اضافه شد

## Webhook URL
```
POST https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/vizzy-glasses-webhook
Headers: x-webhook-key: [YOUR_KEY], Content-Type: application/json
Body: { "imageBase64": "...", "prompt": "optional question" }
```

## قدم‌های بعدی (کاربر)
1. Meta View App را نصب و عینک را pair کنید
2. iOS Shortcut بسازید با prompt زیر
3. Automation تنظیم کنید

## پرامپت iOS Shortcut
> "Build me an iOS Shortcut that: 1) Gets the latest photo from the 'Meta View' album. 2) Converts to base64. 3) POST to https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/vizzy-glasses-webhook with headers x-webhook-key: [YOUR_KEY], Content-Type: application/json. Body: {"imageBase64": [base64]}. 4) Shows 'analysis' as notification. Then create Automation for new photos in Meta View album."
