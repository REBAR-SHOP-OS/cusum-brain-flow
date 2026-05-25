## هدف
نمایش وضعیت هر page به‌صورت دقیق و بدون خطا: هر page که واقعاً publish شده باید سبز دیده شود و فقط pageهای واقعاً failed قرمز بمانند.

## چیزی که پیدا شد
دو علت ریشه‌ای مشخص شد:

1. **از دست رفتن بخشی از `page_results` در backend**
   - در `supabase/functions/social-publish/index.ts` ثبت نتیجه‌ی هر page با `recordPageResult(...)` به‌صورت non-awaited انجام می‌شود.
   - خود `recordPageResult` در `supabase/functions/_shared/publishLock.ts` از الگوی read-modify-write استفاده می‌کند.
   - وقتی چند page پشت‌سرهم publish می‌شوند، این callها با هم race می‌کنند و ممکن است نتیجه‌ی بعضی pageها روی هم overwrite شود.
   - نتیجه: بعضی pageهای واقعاً published اصلاً در `page_results` باقی نمی‌مانند.

2. **منطق رنگ‌دهی UI بیش از حد بدبینانه است**
   - در `src/components/social/SocialCalendar.tsx` اگر برای یک page در `page_results` entry پیدا نشود، در بعضی حالت‌ها قرمز نمایش داده می‌شود.
   - برای postهای legacy که `page_results` خالی است ولی `status = published` دارند، parsing `last_error` هم همه‌ی الگوها را درست تفسیر نمی‌کند.
   - نتیجه: حتی وقتی publish واقعی انجام شده، UI بعضی pageها را قرمز نشان می‌دهد.

## فایل‌های درگیر
- `supabase/functions/social-publish/index.ts`
- `supabase/functions/_shared/publishLock.ts`
- `src/components/social/SocialCalendar.tsx`

## برنامه‌ی اجرا
### 1) پایدار کردن ثبت نتیجه‌ی هر page در backend
- ثبت `page_results` را در مسیر publish به حالت deterministic تغییر می‌دهم تا race condition حذف شود.
- `markSuccess` و `markFailure` را طوری اصلاح می‌کنم که ثبت نتیجه‌ها به‌صورت قابل اتکا انجام شود و هیچ page موفقی گم نشود.
- اگر لازم باشد، helper مربوط به `page_results` را هم بازنویسی می‌کنم تا merge نتایج امن باشد.

### 2) اصلاح منطق interpretation در UI
- `parsePageStatuses` را طوری اصلاح می‌کنم که منبع اصلی truth را درست بخواند.
- وقتی post در وضعیت `published` است، pageهای موفق هرگز به‌خاطر missing entry یا parsing ضعیف به رنگ قرمز نروند.
- fallback برای داده‌های legacy را هم دقیق‌تر می‌کنم تا فقط pageهای واقعاً failed قرمز شوند.

### 3) سازگار کردن حالت‌های partial publish
- اگر بعضی pageها success و بعضی fail شده باشند، UI دقیقاً همان ترکیب را نشان دهد.
- اگر backend `last_error` جزئی داشته باشد ولی `page_results` ناقص باشد، نمایش بر اساس امن‌ترین و دقیق‌ترین interpretation انجام شود.

### 4) اعتبارسنجی نهایی
- مسیر publish چند-page را دوباره بررسی می‌کنم.
- چند نمونه‌ی اخیر LinkedIn/Facebook را با داده‌های ذخیره‌شده تطبیق می‌دهم.
- مطمئن می‌شوم که کارت دیگر فقط به‌خاطر mismatch داخلی قرمز نمی‌شود.

## جزئیات فنی
- مشکل اصلی یک **race condition روی `page_results`** است.
- `page_results` باید برای هر page یک truth پایدار نگه دارد؛ الان این تضمین کامل وجود ندارد.
- UI هم باید نسبت به داده‌های legacy و partial resilient باشد، نه اینکه در حالت‌های ambiguous به‌صورت پیش‌فرض قرمز کند.

## خروجی مورد انتظار
بعد از اعمال این plan:
- هر page که واقعاً publish شده سبز نمایش داده می‌شود.
- فقط pageهای واقعاً failed قرمز می‌مانند.
- وضعیت کارت‌ها با واقعیت backend هم‌خوان می‌شود و mismatch تکرار نمی‌شود.