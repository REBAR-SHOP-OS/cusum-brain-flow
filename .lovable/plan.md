

# نمایش تصاویر + دکمه دانلود + دکمه کپی در چت ساپورت

## وضعیت فعلی
- جدول `support_messages` فیلد `content_type` و `metadata` دارد (آماده برای پشتیبانی تصویر)
- پیام‌ها فقط به صورت متن ساده نمایش داده می‌شوند (هم در پنل ادمین، هم در ویجت)
- هیچ قابلیت آپلود تصویر وجود ندارد

## تغییرات

### ۱. ساخت Storage Bucket: `support-attachments`
Migration برای ایجاد باکت عمومی و RLS policies مناسب.

### ۲. فایل: `src/components/support/SupportChatView.tsx`
- **آپلود تصویر**: اضافه کردن دکمه آپلود (آیکون Paperclip) کنار textarea. فایل به `support-attachments/{conversation_id}/{uuid}.{ext}` آپلود و پیام با `content_type: "image"` و URL تصویر در `content` ذخیره می‌شود.
- **نمایش تصویر**: اگر `content_type === "image"` یا content شامل URL تصویر باشد، به جای متن، تصویر render شود با `<img>` و `max-width: 200px`.
- **دکمه دانلود**: زیر تصاویر، آیکون `Download` برای دانلود تصویر.
- **دکمه کپی**: زیر پیام‌های متنی، آیکون `Copy` که محتوا را به clipboard کپی کند.

### ۳. Edge Function: `supabase/functions/support-chat/index.ts`
- **اکشن جدید `upload`**: ویزیتور تصویر را به صورت base64 ارسال → سرور آن را در storage آپلود → پیام با `content_type: "image"` ذخیره.
- **ویجت JS**: 
  - دکمه آپلود (📎) اضافه شود
  - تصاویر دریافتی به صورت `<img>` نمایش داده شوند (نه متن)
  - دکمه دانلود زیر تصاویر
  - دکمه کپی زیر پیام‌های متنی

### ۴. جزییات فنی

**Admin Side (SupportChatView):**
```tsx
// Image message rendering
{msg.content_type === "image" ? (
  <div>
    <img src={msg.content} className="max-w-[200px] rounded-lg cursor-pointer" />
    <button onClick={() => downloadImage(msg.content)}>
      <Download className="w-3.5 h-3.5" />
    </button>
  </div>
) : (
  <div>
    <p>{msg.content}</p>
    <button onClick={() => navigator.clipboard.writeText(msg.content)}>
      <Copy className="w-3.5 h-3.5" />
    </button>
  </div>
)}
```

**Widget Side (generateWidgetJs):**
- `addMsg` تابع بررسی می‌کند آیا پیام تصویر است → `<img>` + دکمه دانلود
- برای متن → متن + دکمه کپی
- دکمه 📎 برای ارسال تصویر توسط ویزیتور

## فایل‌ها
1. DB Migration — ساخت باکت `support-attachments` + RLS
2. `src/components/support/SupportChatView.tsx` — آپلود + نمایش تصویر + دانلود + کپی
3. `supabase/functions/support-chat/index.ts` — اکشن upload + به‌روزرسانی ویجت JS

