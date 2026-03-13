
مسئله را ریشه‌ای بررسی کردم. علت اصلی خطا ترکیبی است و دقیقا قابل بازتولید است:

1) منبع‌های تصویری Brain با URL امضاشده کوتاه‌مدت ذخیره می‌شوند (۱ ساعت) و بعد منقضی می‌شوند.  
2) در `ai-agent` و `regenerate-post` لینک‌ها با Regex از متن استخراج می‌شوند و Query Token هم حذف می‌شود؛ یعنی حتی لینک معتبر هم خراب می‌شود.  
3) وقتی حتی یک `image_url` نامعتبر داخل درخواست مدل تصویری باشد، کل درخواست 400 می‌خورد.  
4) مسیر OpenAI تصویر هم 400 می‌دهد (پس fallback باید مقاوم باشد)، ولی علت شکست نهایی شما در اسکرین‌شات عملاً attachmentهای Brain نامعتبر است.

برنامه‌ی رفع ریشه‌ای (نه موقت):

## 1) اصلاح هسته تولید تصویر در بک‌اند
فایل‌ها:
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`

کارها:
- حذف وابستگی به استخراج URL از `brainKnowledge` با regex برای image reference.
- ساخت helper داخلی برای «resolve منابع تصویری»:
  - از رکوردهای `knowledge` بخواند (agent=social, category=image).
  - اگر URL از نوع `/storage/v1/object/sign/...` بود، bucket/path را parse کند و با service client **signed URL جدید** بسازد.
  - اگر URL عمومی بود همان را نگه دارد.
  - قبل از استفاده، preflight سبک (HEAD/GET کوتاه) برای valid بودن انجام دهد.
  - فقط فرمت‌های قابل اتکا (`jpg/jpeg/png/webp`) را پاس بدهد؛ `svg` برای reference تصویر حذف شود.
- `generatePixelImage` را resilient کنیم:
  - attempt 1: prompt + refs + logo
  - attempt 2: prompt + logo (بدون refs)
  - attempt 3: prompt text-only (بدون refs/بدون logo)
  - یعنی attachment خراب دیگر کل تولید را زمین نزند.
- لاگ خطای واقعی مدل را ثبت کنیم (status + بخش کوتاه body) تا علت 400 بعدی مبهم نماند.

## 2) حفظ رفتار «ChatGPT انتخاب شده» بدون شکستن تولید
فایل‌ها:
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`
- (در صورت نیاز همسان‌سازی) `supabase/functions/generate-image/index.ts`

کارها:
- وقتی کاربر ChatGPT انتخاب می‌کند، ابتدا مسیر OpenAI همچنان واقعاً امتحان شود.
- اگر OpenAI 400/عدم دسترسی داد، سریع و شفاف fallback به Gemini انجام شود (بدون fail کل خروجی).
- پیام خطای داخلی دقیق‌تر شود اما خروجی کاربر شکست نخورد.

## 3) جلوگیری از تکرار مشکل در داده‌های جدید Brain
فایل:
- `src/components/brain/AddKnowledgeDialog.tsx`

کارها:
- علاوه بر `source_url`، مسیر پایدار فایل را در metadata ذخیره کنیم (مثل `storage_bucket`, `storage_path`).
- از این به بعد backend برای امضا/دسترسی از path پایدار استفاده کند، نه URL منقضی‌شونده.

## 4) نکته تکمیلی کیفیت خروجی
فایل‌ها:
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`

کارها:
- قوانین «عدم تکرار» و «واقع‌گرایی کامل» حفظ و قوی‌تر می‌مانند.
- اگر refs خراب بود، به‌جای fail شدن، با prompt سخت‌گیرانه‌ی realism/uniqueness تصویر تولید می‌شود.

## بخش فنی (خلاصه)
- ریشه خطا: Expired signed URLs + token stripping + brittle multimodal payload.
- راه‌حل فنی: Signed URL refresh at runtime + URL validation + adaptive retries + robust fallback chain.
- نتیجه: حتی با Brain resources منقضی، تولید تصویر قطع نمی‌شود و خروجی همچنان مطابق استایل‌های انتخابی و واقع‌گرایانه تولید می‌شود.

## تست پذیرش بعد از پیاده‌سازی
1) همان سناریوی فعلی `/agent/social` با پیام `1` و style فعال (مثلاً urban) باید تصویر موفق بدهد.  
2) با Brain دارای فایل‌های قدیمی/منقضی هم نباید 400 نهایی بگیریم.  
3) با ChatGPT selected اگر OpenAI خطا داد، خروجی باید با fallback موفق تولید شود.  
4) تصویر خروجی نباید تکراری و نباید غیرواقعی باشد.
