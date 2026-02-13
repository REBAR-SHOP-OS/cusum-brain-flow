
# ذخیره پست تایید شده در تقویم Social Media

## هدف
وقتی کاربر در چت Pixel روی "Approve & Generate Next" کلیک می‌کند، پست فعلی (تصویر، کپشن، هشتگ‌ها) در جدول `social_posts` با وضعیت `draft` و تاریخ انتخابی ذخیره شود تا در صفحه Social Media Calendar نمایش داده شود و منتظر تایید نهایی باشد.

## تغییرات

### 1. بک‌اند: اضافه کردن اطلاعات پست به response (`supabase/functions/ai-agent/index.ts`)
در بخشی که response پیکسل ساخته می‌شود (خطوط 4028-4031)، یک فیلد جدید `pixelPost` به JSON response اضافه می‌شود که شامل اطلاعات پست ساخته‌شده است:

```typescript
{
  reply: pixelReply,
  context: mergedContext,
  nextSlot: nextSlot,
  pixelPost: {
    caption: post.caption,
    hashtags: post.hashtags,
    imageUrl: post.imageUrl,
    platform: "instagram",
    slot: post.slot,
    theme: post.theme,
    product: post.product
  }
}
```

### 2. فرانت‌اند: تایپ `AgentResponse` (`src/lib/agent.ts`)
اضافه کردن فیلد `pixelPost` به اینترفیس:

```typescript
export interface AgentResponse {
  reply: string;
  context?: Record<string, unknown>;
  createdNotifications?: { ... }[];
  nextSlot?: number | null;
  pixelPost?: {
    caption: string;
    hashtags: string;
    imageUrl: string;
    platform: string;
    slot: string;
    theme: string;
    product: string;
  };
}
```

### 3. فرانت‌اند: ذخیره در DB هنگام تایید (`src/pages/AgentWorkspace.tsx`)
در تابع `handleSendInternal`، وقتی پاسخ Pixel دارای `pixelPost` باشد، آن را در state نگه می‌داریم. سپس در `handleApprovePixelSlot`، قبل از فراخوانی اسلات بعدی، پست فعلی را در `social_posts` ذخیره می‌کنیم:

- اضافه کردن state: `lastPixelPost` برای نگهداری اطلاعات آخرین پست ساخته شده
- در `handleApprovePixelSlot`:
  1. ابتدا پست را در `social_posts` با `status: "draft"` و `scheduled_date: selectedDate` ذخیره کن
  2. سپس اسلات بعدی را بساز
- برای آخرین پست (slot 5) که `nextSlot` نیست، یک دکمه "Approve" جداگانه نمایش داده می‌شود که فقط ذخیره می‌کند

### 4. نمایش toast تایید
بعد از ذخیره موفق هر پست، یک toast نمایش داده می‌شود: "Post saved to calendar as draft"

## نتیجه
پست‌های تایید شده در Pixel agent به صورت draft در تقویم Social Media ظاهر می‌شوند و کاربر می‌تواند از آنجا تایید نهایی و publish انجام دهد.
