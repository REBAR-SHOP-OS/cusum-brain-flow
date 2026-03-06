

# تنظیم صحیح تاریخ و ساعت پست‌های Pixel در تقویم سوشیال مدیا

## مشکل
وقتی پست در ایجنت Pixel ساخته/تأیید می‌شود، `scheduled_date` نادرست ذخیره می‌شود (مثلاً 12:00 AM به جای ساعت واقعی اسلات). دلیل: فیلد `time` از PIXEL_SLOTS حذف شد اما کد کلاینت هنوز سعی می‌کند ساعت را از آن بخواند.

## راه‌حل
ساعت‌های انتشار هر اسلات را در کلاینت تعریف کنیم (بدون نمایش در کپشن) و هنگام ذخیره پست، ساعت صحیح را روی `scheduled_date` اعمال کنیم.

## تغییرات

### ۱. فایل: `src/lib/agent.ts` — اضافه کردن `slotNumber` به `PixelPost`
```typescript
export interface PixelPost {
  caption: string;
  hashtags: string;
  imageUrl: string;
  platform: string;
  slot: string;
  theme: string;
  product: string;
  slotNumber?: number; // 1-5
}
```

### ۲. فایل: `src/pages/AgentWorkspace.tsx`

**الف) تعریف mapping ساعت اسلات‌ها (ثابت):**
```typescript
const SLOT_TIMES = [
  { hour: 6, minute: 30 },   // slot 1
  { hour: 7, minute: 30 },   // slot 2
  { hour: 8, minute: 0 },    // slot 3
  { hour: 12, minute: 30 },  // slot 4
  { hour: 14, minute: 30 },  // slot 5
];
```

**ب) اصلاح `handleApprovePixelSlot` (خط ~309-332):**
به جای parse کردن ساعت از `lastPixelPost.slot`، از `SLOT_TIMES` و شماره اسلات استفاده شود:
```typescript
const scheduledDate = new Date(selectedDate);
const slotIdx = (lastPixelPost.slotNumber || 1) - 1;
const slotTime = SLOT_TIMES[slotIdx] || SLOT_TIMES[0];
scheduledDate.setHours(slotTime.hour, slotTime.minute, 0, 0);
```

**ج) اصلاح `handleApprovePost` (خط ~401-408):**
شماره اسلات را از `post.id` استخراج کرده و ساعت صحیح اعمال شود:
```typescript
const scheduledDate = new Date(selectedDate);
const idMatch = post.id?.match(/^post-(\d+)/);
const slotIdx = idMatch ? parseInt(idMatch[1]) : 0;
const slotTime = SLOT_TIMES[slotIdx] || SLOT_TIMES[0];
scheduledDate.setHours(slotTime.hour, slotTime.minute, 0, 0);
// ...
scheduled_date: scheduledDate.toISOString(),
```

### ۳. فایل: `supabase/functions/ai-agent/index.ts` — ارسال `slotNumber` در response
در بخش تولید تصویر (خط ~625-655)، شماره اسلات را در metadata برگردانیم تا کلاینت بتواند از آن استفاده کند. اسلات از `slot.slot` (عدد ۱-۵) گرفته می‌شود.

## فایل‌های تغییر
1. `src/lib/agent.ts` — اضافه کردن `slotNumber` به interface
2. `src/pages/AgentWorkspace.tsx` — اصلاح ساعت‌گذاری در هر دو تابع approve
3. `supabase/functions/ai-agent/index.ts` — ارسال شماره اسلات در پاسخ

