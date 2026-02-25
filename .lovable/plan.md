

## اضافه کردن دکمه‌های تایید و بازسازی زیر هر پست Pixel و ذخیره در تقویم

### وضعیت فعلی
- بعد از تولید عکس و کپشن، `PixelChatRenderer` آن‌ها را به صورت `PixelPostCard` کوچک نمایش می‌دهد (فقط thumbnail + متن + یک دکمه تیک).
- دکمه‌های Approve بزرگ در انتهای ChatThread نمایش داده می‌شوند (خارج از پیام).
- `onViewPost` اصلاً به ChatThread پاس داده نمی‌شود (خط ۵۴۴ فایل AgentWorkspace).
- وقتی کاربر Approve می‌زند، `handleApprovePixelSlot` پست را در `social_posts` ذخیره می‌کند.

### هدف
- زیر هر تصویر + کپشن تولیدشده، دو آیکون نمایش داده شود:
  1. **تایید (Approve)**: ذخیره پست در جدول `social_posts` برای همان روز انتخاب‌شده و نمایش در تقویم Social Media Manager
  2. **بازسازی (Regenerate)**: ارسال دستور بازسازی تصویر و کپشن به ایجنت

### تغییرات

#### 1. بازطراحی `PixelPostCard` (فایل: `src/components/social/PixelPostCard.tsx`)
- نمایش تصویر بزرگ‌تر (نه فقط thumbnail) در بالا
- نمایش کپشن و هشتگ زیر تصویر
- اضافه کردن دو آیکون زیر کپشن:
  - آیکون **CheckCircle** (تایید): با کلیک، callback `onApprove(post)` صدا زده می‌شود
  - آیکون **RefreshCw** (بازسازی): با کلیک، callback `onRegenerate(post)` صدا زده می‌شود
- بعد از تایید، آیکون تایید سبز شود و غیرفعال گردد و متن "Saved to calendar" نمایش داده شود

#### 2. به‌روزرسانی `PixelChatRenderer` (فایل: `src/components/social/PixelChatRenderer.tsx`)
- اضافه کردن prop جدید `onApprovePost: (post: PixelPostData) => void`
- اضافه کردن prop جدید `onRegeneratePost: (post: PixelPostData) => void`
- پاس دادن این دو callback به هر `PixelPostCard`

#### 3. به‌روزرسانی `ChatMessage` (فایل: `src/components/chat/ChatMessage.tsx`)
- اضافه کردن props `onApprovePost` و `onRegeneratePost` به interface
- پاس دادن آن‌ها به `PixelChatRenderer`

#### 4. به‌روزرسانی `ChatThread` (فایل: `src/components/chat/ChatThread.tsx`)
- اضافه کردن props `onApprovePost` و `onRegeneratePost`
- پاس دادن آن‌ها به هر `ChatMessage`
- حذف دکمه‌های بزرگ Approve از انتهای thread (چون حالا هر پست دکمه خودش را دارد)

#### 5. به‌روزرسانی `AgentWorkspace` (فایل: `src/pages/AgentWorkspace.tsx`)
- ایجاد `handleApprovePost` callback:
  - دریافت `PixelPostData` (شامل imageUrl, caption, hashtags)
  - ذخیره در `social_posts` با status `draft`، تاریخ `selectedDate`، و `user_id`
  - نمایش toast موفقیت
- ایجاد `handleRegeneratePost` callback:
  - ارسال پیام `regenerate` به ایجنت (از طریق `handleSendInternal`)
- پاس دادن این دو callback به `ChatThread`

### جزییات فنی ذخیره پست در تقویم

هنگام تایید، این فیلدها در `social_posts` ذخیره می‌شود:
```text
platform: "instagram" (پیش‌فرض)
status: "draft"
title: caption (اولین ۵۰ کاراکتر)
content: caption کامل
image_url: imageUrl از پست
hashtags: آرایه هشتگ‌ها (split از string)
scheduled_date: selectedDate (تاریخ انتخاب‌شده در تقویم Pixel)
user_id: user.id
```

### فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `src/components/social/PixelPostCard.tsx` | بازطراحی UI + اضافه کردن دکمه approve و regenerate |
| `src/components/social/PixelChatRenderer.tsx` | اضافه کردن props و پاس دادن callbackها |
| `src/components/chat/ChatMessage.tsx` | اضافه کردن props جدید |
| `src/components/chat/ChatThread.tsx` | اضافه کردن props + حذف دکمه‌های بزرگ قبلی |
| `src/pages/AgentWorkspace.tsx` | ایجاد handleApprovePost و handleRegeneratePost |

### نکات مهم
- سایر ایجنت‌ها تغییری نمی‌کنند (props اختیاری هستند)
- تغییرات دیتابیس نیاز نیست (جدول `social_posts` از قبل موجود است)
- بعد از ذخیره، پست در صفحه `/social-media-manager` در تقویم هفتگی قابل مشاهده خواهد بود
