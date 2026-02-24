

## رفع مشکل Speed Dashboard و Image Optimizer

### ریشه مشکل
بر اساس لاگ‌ها، فانکشن `wp-speed-optimizer` واقعا کار می‌کند (۳۱ تصویر بهینه شده) ولی **بیش از ۳ دقیقه طول می‌کشد** و اتصال HTTP قبل از دریافت نتیجه قطع می‌شود:

```
17:49:40 — شروع
17:52:46 — اتمام (۳+ دقیقه)
ERROR: Http: connection closed before message completed
```

همچنین CORS headers ناقص هستند و مشکلات سرور-ساید (نصب پلاگین کش، Redis، و...) قابل حل توسط API نیستند و باید به عنوان تسک به radin ارسال شوند.

---

### محدوده تغییرات (فقط ۲ فایل)

**فایل ۱: `supabase/functions/wp-speed-optimizer/index.ts`**
**فایل ۲: `src/components/website/SpeedDashboard.tsx`**

---

### تغییرات فنی

#### فایل ۱: `wp-speed-optimizer/index.ts`

1. **رفع CORS**: اضافه کردن تمام headerهای لازم (مانند سایر فانکشن‌ها)
2. **پردازش Background + نتیجه فوری**: به جای اینکه کلاینت منتظر ۳+ دقیقه بماند:
   - فوری یک response برگردانیم با `{ accepted: true, job_id }`
   - پردازش در background ادامه پیدا کند
   - نتایج در جدول `wp_change_log` ذخیره شود
   - اگر مشکلات سرور-ساید پیدا شد، تسک برای radin ایجاد کند
3. **ایجاد تسک خودکار**: بعد از اتمام optimizer، مشکلاتی که نیاز به دسترسی سرور دارند (نصب پلاگین کش، Redis، پاکسازی دیتابیس) به صورت تسک در جدول `tasks` با `assigned_to = radin` ثبت شوند

#### فایل ۲: `SpeedDashboard.tsx`

1. **مدیریت تایم‌اوت**: اگر درخواست optimizer timeout شد، به کاربر بگوید "بهینه‌سازی در حال اجراست و نتایج به صورت تسک ارسال می‌شود"
2. **نمایش وضعیت**: پیام مناسب بعد از ارسال درخواست optimize
3. **Timeout افزایش**: AbortController با timeout بالاتر (۳ دقیقه) برای جلوگیری از قطع زودهنگام

---

### جزئیات فنی

#### Background Processing Pattern
```typescript
// بلافاصله response بده
const jobId = crypto.randomUUID();
const responsePromise = new Response(JSON.stringify({ 
  accepted: true, job_id: jobId, 
  message: "Optimization started. Tasks will be created for issues found." 
}));

// بعد processing در background
// ...optimize images...
// سپس تسک ایجاد کن:
await supabase.from("tasks").insert({
  title: "Install Caching Plugin on rebar.shop",
  description: "...",
  assigned_to: "be3b9444-2114-4a05-b9ae-2c4df9fbceb8", // radin
  company_id: "a0000000-0000-0000-0000-000000000001",
  source: "speed-optimizer",
  priority: "high",
});
```

#### SpeedDashboard UI Change
```typescript
// Handle accepted response
onSuccess: (data) => {
  if (data.accepted) {
    toast.success("Optimization started! Results and tasks will be created automatically.");
  } else if (data.dry_run) {
    toast.success(`Scan: ${data.images_fixed} images can be optimized`);
  } else {
    toast.success(`Optimized ${data.images_fixed} images`);
  }
},
// Handle timeout gracefully  
onError: (err) => {
  if (err.message.includes("timed out") || err.message.includes("Failed to fetch")) {
    toast.info("Optimization is running in background. Check Tasks page for results.");
  } else {
    toast.error(`Optimizer failed: ${err.message}`);
  }
}
```

#### تسک‌های ایجاد شده برای radin
بعد از هر بار اجرای optimizer (حالت live)، این تسک‌ها ایجاد می‌شوند:
1. "Install Caching Plugin (LiteSpeed/WP Super Cache)" — priority: high
2. "Enable Redis Object Cache" — priority: high
3. "Clean Autoloaded Options Bloat (1.1MB)" — priority: high
4. "Clean Air Lift Leftovers from Database" — priority: medium
5. "Install Image Compression Plugin (ShortPixel/Imagify)" — priority: medium
6. "Fix Consent API Non-Compliance" — priority: low

---

### نتیجه
- دکمه Optimize Now دیگر خطا نمی‌دهد
- بهینه‌سازی تصاویر در background اجرا می‌شود
- مشکلات سرور-ساید به عنوان تسک به radin ارسال می‌شوند
- کاربر پیام مناسب دریافت می‌کند

