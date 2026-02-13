
# حذف متن "Send 1" و غیرفعال کردن عملکرد شورتکات "1" در Pixel

## تغییرات

### 1. فایل `src/pages/AgentWorkspace.tsx` (خط 413)
- حذف خط `<p className="text-xs ...">Send <strong>1</strong> to generate content for this date</p>`

### 2. فایل `supabase/functions/ai-agent/index.ts` (خطوط 3630-3634)
- حذف بلوک شرطی که عدد "1" یا "۱" را به تاریخ امروز تبدیل می‌کند:

```typescript
// این بلوک حذف می‌شود:
if (trimmedMsg === "1" || trimmedMsg === "۱") {
  const todayStr = new Date().toISOString().split("T")[0];
  message = todayStr;
}
```

## نتیجه
- متن راهنما از صفحه اصلی چت Pixel حذف می‌شود
- ارسال عدد "1" دیگر به‌صورت خودکار به تاریخ تبدیل نمی‌شود و مانند یک پیام عادی رفتار خواهد کرد
